import type { Character, CharacterArtwork, Element, ReleaseStatus } from '@/types'

/**
 * Seed character catalog.
 *
 * `internalName` is the stable key used to build official asset lookups
 * (`UI_Gacha_AvatarImg_<internalName>`). Display names are never the lookup key.
 *
 * `gameCharacterId` is intentionally left blank here rather than guessed - the
 * admin can fill it in, and nothing in the app depends on it being present.
 */

const NOW = '2025-01-01T00:00:00.000Z'

/** Sentinel URL. The renderer draws a themed lunar placeholder for this value. */
export const PLACEHOLDER_URL = 'lunavota:placeholder'

export function makePlaceholder(characterId: string): CharacterArtwork {
  return {
    id: `${characterId}-placeholder`,
    characterId,
    status: 'placeholder',
    sourceType: 'generated-placeholder',
    localUrl: PLACEHOLDER_URL,
    transparentBackground: true,
    addedAt: NOW,
    updatedAt: NOW,
    approved: true,
  }
}

type Row = [
  id: string,
  displayName: string,
  internalName: string,
  element: Element,
  weaponType: string,
  region: string,
  rarity: number,
  releaseStatus: ReleaseStatus,
  signatureWeaponName?: string,
]

const ROWS: Row[] = [
  // --- Mondstadt ---------------------------------------------------------
  ['venti', 'Venti', 'Venti', 'anemo', 'Bow', 'Mondstadt', 5, 'released', 'Elegy for the End'],
  ['diluc', 'Diluc', 'Diluc', 'pyro', 'Claymore', 'Mondstadt', 5, 'released', 'Wolf’s Gravestone'],
  ['jean', 'Jean', 'Qin', 'anemo', 'Sword', 'Mondstadt', 5, 'released', 'Aquila Favonia'],
  ['klee', 'Klee', 'Klee', 'pyro', 'Catalyst', 'Mondstadt', 5, 'released', 'Lost Prayer to the Sacred Winds'],
  ['albedo', 'Albedo', 'Albedo', 'geo', 'Sword', 'Mondstadt', 5, 'released', 'Cinnabar Spindle'],
  ['mona', 'Mona', 'Mona', 'hydro', 'Catalyst', 'Mondstadt', 5, 'released'],
  ['eula', 'Eula', 'Eula', 'cryo', 'Claymore', 'Mondstadt', 5, 'released', 'Song of Broken Pines'],
  ['kazuha', 'Kaedehara Kazuha', 'Kazuha', 'anemo', 'Sword', 'Inazuma', 5, 'released', 'Freedom-Sworn'],

  // --- Liyue -------------------------------------------------------------
  ['zhongli', 'Zhongli', 'Zhongli', 'geo', 'Polearm', 'Liyue', 5, 'released', 'Vortex Vanquisher'],
  ['xiao', 'Xiao', 'Xiao', 'anemo', 'Polearm', 'Liyue', 5, 'released', 'Primordial Jade Winged-Spear'],
  ['ganyu', 'Ganyu', 'Ganyu', 'cryo', 'Bow', 'Liyue', 5, 'released', 'Amos’ Bow'],
  ['hutao', 'Hu Tao', 'Hutao', 'pyro', 'Polearm', 'Liyue', 5, 'released', 'Staff of Homa'],
  ['keqing', 'Keqing', 'Keqing', 'electro', 'Sword', 'Liyue', 5, 'released'],
  ['qiqi', 'Qiqi', 'Qiqi', 'cryo', 'Sword', 'Liyue', 5, 'released'],
  ['tartaglia', 'Tartaglia', 'Tartaglia', 'hydro', 'Bow', 'Snezhnaya', 5, 'released', 'Polar Star'],
  ['shenhe', 'Shenhe', 'Shenhe', 'cryo', 'Polearm', 'Liyue', 5, 'released', 'Calamity Queller'],
  ['yelan', 'Yelan', 'Yelan', 'hydro', 'Bow', 'Liyue', 5, 'released', 'Aqua Simulacra'],
  ['baizhu', 'Baizhu', 'Baizhuer', 'dendro', 'Catalyst', 'Liyue', 5, 'released', 'Jadefall’s Splendor'],
  ['xianyun', 'Xianyun', 'Liuyun', 'anemo', 'Catalyst', 'Liyue', 5, 'released', 'Crane’s Echoing Call'],
  ['gaming', 'Gaming', 'Gaming', 'pyro', 'Claymore', 'Liyue', 4, 'released'],

  // --- Inazuma -----------------------------------------------------------
  ['ayaka', 'Kamisato Ayaka', 'Ayaka', 'cryo', 'Sword', 'Inazuma', 5, 'released', 'Mistsplitter Reforged'],
  ['ayato', 'Kamisato Ayato', 'Ayato', 'hydro', 'Sword', 'Inazuma', 5, 'released', 'Haran Geppaku Futsu'],
  ['raiden', 'Raiden Shogun', 'Shougun', 'electro', 'Polearm', 'Inazuma', 5, 'released', 'Engulfing Lightning'],
  ['yoimiya', 'Yoimiya', 'Yoimiya', 'pyro', 'Bow', 'Inazuma', 5, 'released', 'Thundering Pulse'],
  ['kokomi', 'Sangonomiya Kokomi', 'Kokomi', 'hydro', 'Catalyst', 'Inazuma', 5, 'released', 'Everlasting Moonglow'],
  ['itto', 'Arataki Itto', 'Itto', 'geo', 'Claymore', 'Inazuma', 5, 'released', 'Redhorn Stonethresher'],
  ['yaemiko', 'Yae Miko', 'Yae', 'electro', 'Catalyst', 'Inazuma', 5, 'released', 'Kagura’s Verity'],
  ['kirara', 'Kirara', 'Momoka', 'dendro', 'Sword', 'Inazuma', 4, 'released'],

  // --- Sumeru ------------------------------------------------------------
  ['nilou', 'Nilou', 'Nilou', 'hydro', 'Sword', 'Sumeru', 5, 'released', 'Key of Khaj-Nisut'],
  ['nahida', 'Nahida', 'Nahida', 'dendro', 'Catalyst', 'Sumeru', 5, 'released', 'A Thousand Floating Dreams'],
  ['wanderer', 'Wanderer', 'Wanderer', 'anemo', 'Catalyst', 'Sumeru', 5, 'released', 'Tulaytullah’s Remembrance'],
  ['alhaitham', 'Alhaitham', 'Alhatham', 'dendro', 'Sword', 'Sumeru', 5, 'released', 'Light of Foliar Incision'],
  ['dehya', 'Dehya', 'Dehya', 'pyro', 'Claymore', 'Sumeru', 5, 'released', 'Beacon of the Reed Sea'],
  ['cyno', 'Cyno', 'Cyno', 'electro', 'Polearm', 'Sumeru', 5, 'released', 'Staff of the Scarlet Sands'],
  ['tighnari', 'Tighnari', 'Tighnari', 'dendro', 'Bow', 'Sumeru', 5, 'released', 'Hunter’s Path'],

  // --- Fontaine ----------------------------------------------------------
  ['lyney', 'Lyney', 'Liney', 'pyro', 'Bow', 'Fontaine', 5, 'released', 'The First Great Magic'],
  ['neuvillette', 'Neuvillette', 'Neuvillette', 'hydro', 'Catalyst', 'Fontaine', 5, 'released', 'Tome of the Eternal Flow'],
  ['wriothesley', 'Wriothesley', 'Wriothesley', 'cryo', 'Catalyst', 'Fontaine', 5, 'released', 'Cashflow Supervision'],
  ['furina', 'Furina', 'Furina', 'hydro', 'Sword', 'Fontaine', 5, 'released', 'Splendor of Tranquil Waters'],
  ['navia', 'Navia', 'Navia', 'geo', 'Claymore', 'Fontaine', 5, 'released', 'Verdict'],
  ['arlecchino', 'Arlecchino', 'Arlecchino', 'pyro', 'Polearm', 'Snezhnaya', 5, 'released', 'Crimson Moon’s Semblance'],
  ['clorinde', 'Clorinde', 'Clorinde', 'electro', 'Sword', 'Fontaine', 5, 'released', 'Absolution'],
  ['sigewinne', 'Sigewinne', 'Sigewinne', 'hydro', 'Bow', 'Fontaine', 5, 'released', 'Silvershower Heartstrings'],
  ['emilie', 'Emilie', 'Emilie', 'dendro', 'Polearm', 'Fontaine', 5, 'released', 'Lumidouce Elegy'],

  // --- Natlan ------------------------------------------------------------
  ['mualani', 'Mualani', 'Mualani', 'hydro', 'Catalyst', 'Natlan', 5, 'released', 'Surf’s Up'],
  ['kinich', 'Kinich', 'Kinich', 'dendro', 'Claymore', 'Natlan', 5, 'released', 'Fang of the Mountain King'],
  ['xilonen', 'Xilonen', 'Xilonen', 'geo', 'Sword', 'Natlan', 5, 'released', 'Peak Patrol Song'],
  ['chasca', 'Chasca', 'Chasca', 'anemo', 'Bow', 'Natlan', 5, 'released', 'Astral Vulture’s Crimson Plumage'],
  ['mavuika', 'Mavuika', 'Mavuika', 'pyro', 'Claymore', 'Natlan', 5, 'released', 'A Thousand Blazing Suns'],
  ['citlali', 'Citlali', 'Citlali', 'cryo', 'Catalyst', 'Natlan', 5, 'released', 'Starcaller’s Watch'],
  ['varesa', 'Varesa', 'Varesa', 'electro', 'Catalyst', 'Natlan', 5, 'released', 'Vivid Notions'],
  ['iansan', 'Iansan', 'Iansan', 'electro', 'Polearm', 'Natlan', 4, 'released'],

  // --- Snezhnaya / Nod-Krai era -----------------------------------------
  ['skirk', 'Skirk', 'Skirk', 'cryo', 'Sword', 'Snezhnaya', 5, 'released', 'Azurelight'],
  ['escoffier', 'Escoffier', 'Escoffier', 'cryo', 'Polearm', 'Fontaine', 5, 'released', 'Symphonist of Scents'],
  ['dahlia', 'Dahlia', 'Dahlia', 'hydro', 'Sword', 'Mondstadt', 4, 'released'],
  ['ineffa', 'Ineffa', 'Ineffa', 'electro', 'Polearm', 'Nod-Krai', 5, 'released'],
  ['lauma', 'Lauma', 'Lauma', 'dendro', 'Catalyst', 'Nod-Krai', 5, 'official-unreleased'],
  ['flins', 'Flins', 'Flins', 'electro', 'Polearm', 'Nod-Krai', 5, 'official-unreleased'],
  ['aino', 'Aino', 'Aino', 'hydro', 'Claymore', 'Nod-Krai', 4, 'official-unreleased'],

  // --- Announced / anticipated, no playable assets yet -------------------
  ['columbina', 'Columbina', 'Columbina', 'cryo', 'Catalyst', 'Snezhnaya', 5, 'official-unreleased'],
  ['mitya', 'Mitya', 'Mitya', 'unknown', 'Unknown', 'Nod-Krai', 5, 'leaked'],
  ['valeriy', 'Valeriy', 'Valeriy', 'unknown', 'Unknown', 'Nod-Krai', 5, 'leaked'],
  ['tsaritsa', 'Tsaritsa', 'Tsaritsa', 'cryo', 'Unknown', 'Snezhnaya', 5, 'speculative'],
  ['varka', 'Varka', 'Varka', 'unknown', 'Claymore', 'Mondstadt', 5, 'speculative'],
  ['dainsleif', 'Dainsleif', 'Dainsleif', 'unknown', 'Sword', 'Khaenri’ah', 5, 'speculative'],
]

export function buildSeedCharacters(): Character[] {
  return ROWS.map(
    ([id, displayName, internalName, element, weaponType, region, rarity, releaseStatus, signatureWeaponName]) => {
      const charId = releaseStatus === 'released' || releaseStatus === 'official-unreleased' ? id : `temp:${id}`
      return {
        id: charId,
        internalName,
        displayName,
        releaseStatus,
        element,
        rarity,
        weaponType,
        region,
        signatureWeaponName,
        assets: { placeholder: makePlaceholder(charId) },
        updatedAt: NOW,
      }
    },
  )
}
