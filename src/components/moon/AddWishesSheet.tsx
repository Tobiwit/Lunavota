import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { NumberField } from '@/components/ui/controls'
import { useStore } from '@/store/useStore'
import { totalWishes } from '@/engine/wish'

/**
 * "+ Wishes" — the interaction that gets used most often, so it is built for
 * one thumb and a few seconds.
 */

const PRIMO_PRESETS = [60, 90, 160, 300, 600, 800]
const FATE_PRESETS = [1, 5, 10]

export function AddWishesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useStore((s) => s.user)
  const addResources = useStore((s) => s.addResources)
  const setUser = useStore((s) => s.setUser)

  const [mode, setMode] = useState<'add' | 'set'>('add')
  const [primos, setPrimos] = useState(0)
  const [fates, setFates] = useState(0)
  const [setPrimosValue, setSetPrimosValue] = useState(user.primogems)
  const [setFatesValue, setSetFatesValue] = useState(user.intertwinedFates)
  const [setCrystalsValue, setSetCrystalsValue] = useState(user.genesisCrystals)

  const reset = () => {
    setPrimos(0)
    setFates(0)
  }

  const openSet = () => {
    setSetPrimosValue(user.primogems)
    setSetFatesValue(user.intertwinedFates)
    setSetCrystalsValue(user.genesisCrystals)
    setMode('set')
  }

  const apply = () => {
    if (mode === 'add') {
      addResources({ primogems: primos, intertwinedFates: fates })
    } else {
      setUser({
        primogems: setPrimosValue,
        intertwinedFates: setFatesValue,
        genesisCrystals: setCrystalsValue,
      })
    }
    reset()
    onClose()
  }

  const preview =
    mode === 'add'
      ? totalWishes({
          intertwinedFates: user.intertwinedFates + fates,
          primogems: user.primogems + primos,
          genesisCrystals: user.genesisCrystals,
        })
      : totalWishes({
          intertwinedFates: setFatesValue,
          primogems: setPrimosValue,
          genesisCrystals: setCrystalsValue,
        })

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={mode === 'add' ? 'New resources' : 'Correct your balance'}
      title={mode === 'add' ? 'What did you earn?' : 'Set your totals'}
      footer={
        <div className="flex gap-2.5">
          <button type="button" className="btn btn-quiet flex-1" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary flex-[2]"
            onClick={apply}
            disabled={mode === 'add' && primos === 0 && fates === 0}
          >
            {mode === 'add' ? 'Add' : 'Save'}
          </button>
        </div>
      }
    >
      {mode === 'add' ? (
        <div className="space-y-6">
          <div>
            <p className="eyebrow mb-2.5">Primogems</p>
            <div className="flex flex-wrap gap-2">
              {PRIMO_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="chip num"
                  onClick={() => setPrimos((v) => v + p)}
                >
                  +{p}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <NumberField label="Primogems to add" value={primos} onChange={setPrimos} step={160} />
            </div>
          </div>

          <div>
            <p className="eyebrow mb-2.5">Intertwined Fates</p>
            <div className="flex flex-wrap gap-2">
              {FATE_PRESETS.map((f) => (
                <button key={f} type="button" className="chip num" onClick={() => setFates((v) => v + f)}>
                  +{f}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <NumberField label="Fates to add" value={fates} onChange={setFates} />
            </div>
          </div>

          <button
            type="button"
            onClick={openSet}
            className="text-[12px] text-frost/80 underline-offset-4 hover:underline"
          >
            My totals are wrong — let me set them directly
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <NumberField label="Intertwined Fates" value={setFatesValue} onChange={setSetFatesValue} />
          <NumberField label="Primogems" value={setPrimosValue} onChange={setSetPrimosValue} step={160} />
          <NumberField label="Genesis Crystals" value={setCrystalsValue} onChange={setSetCrystalsValue} step={160} />
          <button
            type="button"
            onClick={() => setMode('add')}
            className="text-[12px] text-frost/80 underline-offset-4 hover:underline"
          >
            Back to adding
          </button>
        </div>
      )}

      <div className="panel-flat mt-6 flex items-baseline justify-between px-4 py-3.5">
        <span className="eyebrow">Wishes after this</span>
        <span className="num font-display text-[26px] text-moon">{preview}</span>
      </div>
    </Sheet>
  )
}
