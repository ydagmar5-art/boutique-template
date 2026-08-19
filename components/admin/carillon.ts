/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  CARILLON — deux notes à l'arrivée d'une visiteuse               ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Le son est SYNTHÉTISÉ ici puis emballé dans un WAV en mémoire : aucun
 * fichier à héberger, et le timbre reste maîtrisé.
 *
 * ⚠️ POURQUOI UN <audio> ET NON UN AudioContext.
 * Première version : AudioContext. Elle ne sonnait qu'une fois sur deux. La
 * raison est que l'autorisation d'un contexte audio est fragile — il retombe
 * en « suspended » quand l'onglet passe en arrière-plan ou après une période
 * d'inactivité, et le réveil hors d'un geste utilisateur est refusé. Or c'est
 * précisément dans un onglet d'arrière-plan que ce carillon sert.
 *
 * Un élément <audio> AMORCÉ pendant un vrai clic (joué puis immédiatement
 * mis en pause) reste, lui, rejouable par programme aussi longtemps que la
 * page vit. C'est le mécanisme retenu.
 *
 * ⚠️ `amorcer()` DOIT être appelé depuis un gestionnaire de clic, sans await
 * avant lui : c'est la seule fenêtre où le navigateur l'autorise.
 */

/** Fréquence d'échantillonnage — 44,1 kHz, la valeur universelle. */
const TAUX = 44100;

/** Deux sinus : la5 puis mi6, une quinte ascendante. */
function echantillons(): Float32Array {
  const duree = 0.32;
  const n = Math.floor(TAUX * duree);
  const buf = new Float32Array(n);
  const notes = [
    { f: 880, debut: 0, duree: 0.14, volume: 0.5 },
    { f: 1318.5, debut: 0.085, duree: 0.2, volume: 0.4 },
  ];
  for (const note of notes) {
    const i0 = Math.floor(note.debut * TAUX);
    const len = Math.floor(note.duree * TAUX);
    for (let i = 0; i < len && i0 + i < n; i++) {
      const t = i / TAUX;
      // Attaque de 12 ms puis extinction exponentielle : sans l'attaque, le
      // démarrage brutal produit un « clic » audible.
      const attaque = Math.min(1, t / 0.012);
      const chute = Math.exp(-t * 14);
      buf[i0 + i] += Math.sin(2 * Math.PI * note.f * t) * note.volume * attaque * chute;
    }
  }
  return buf;
}

/** Emballe les échantillons dans un WAV PCM 16 bits mono. */
function versWav(data: Float32Array): string {
  const octets = new ArrayBuffer(44 + data.length * 2);
  const vue = new DataView(octets);
  const txt = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) vue.setUint8(pos + i, s.charCodeAt(i));
  };
  txt(0, "RIFF");
  vue.setUint32(4, 36 + data.length * 2, true);
  txt(8, "WAVEfmt ");
  vue.setUint32(16, 16, true); // taille du bloc fmt
  vue.setUint16(20, 1, true); // PCM
  vue.setUint16(22, 1, true); // mono
  vue.setUint32(24, TAUX, true);
  vue.setUint32(28, TAUX * 2, true); // octets par seconde
  vue.setUint16(32, 2, true); // alignement
  vue.setUint16(34, 16, true); // bits par échantillon
  txt(36, "data");
  vue.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) {
    const v = Math.max(-1, Math.min(1, data[i]));
    vue.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  let binaire = "";
  const brut = new Uint8Array(octets);
  for (let i = 0; i < brut.length; i++) binaire += String.fromCharCode(brut[i]);
  return `data:audio/wav;base64,${btoa(binaire)}`;
}

let element: HTMLAudioElement | null = null;
let amorce = false;
let refuse = false;

export type EtatAudio = "vierge" | "actif" | "refuse";

export function etatAudio(): EtatAudio {
  if (refuse) return "refuse";
  return amorce ? "actif" : "vierge";
}

function obtenir(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (element) return element;
  try {
    element = new Audio(versWav(echantillons()));
    element.preload = "auto";
    element.volume = 0.35;
  } catch {
    return null;
  }
  return element;
}

/**
 * Déverrouille le son. ⚠️ À appeler DEPUIS un geste utilisateur.
 * Joue puis remet à zéro immédiatement : l'élément devient rejouable par
 * programme pour toute la durée de vie de la page.
 */
export function amorcer(): void {
  const el = obtenir();
  if (!el || amorce) return;
  const volume = el.volume;
  el.volume = 0; // amorçage silencieux
  el.play()
    .then(() => {
      el.pause();
      el.currentTime = 0;
      el.volume = volume;
      amorce = true;
      refuse = false;
    })
    .catch(() => {
      el.volume = volume;
      refuse = true;
    });
}

/** Joue le carillon. Ne lève jamais : un tableau de bord ne casse pas pour ça. */
export function jouerCarillon(): void {
  const el = obtenir();
  if (!el) return;
  try {
    el.currentTime = 0;
    el.play()
      .then(() => {
        amorce = true;
        refuse = false;
      })
      .catch(() => {
        // Le navigateur exige un geste : on le signale à l'interface plutôt
        // que d'échouer en silence, comme le faisait la version précédente.
        refuse = true;
      });
  } catch {
    refuse = true;
  }
}
