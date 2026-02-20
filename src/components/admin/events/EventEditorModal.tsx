import type { Dispatch, SetStateAction } from 'react';
import { Image as ImageIcon, Music2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import type { EventFormState } from '@/components/admin/events/types';

interface EventEditorModalProps {
  isOpen: boolean;
  isEditing: boolean;
  errorMessage: string;
  saving: boolean;
  deleting: boolean;
  formState: EventFormState;
  setFormState: Dispatch<SetStateAction<EventFormState>>;
  midiSongs: string[];
  logos: string[];
  midiSet: Set<string>;
  logoSet: Set<string>;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
}

function ToggleSwitch({
  checked,
  onClick,
  disabled,
  id,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  disabled: boolean;
  id: string;
  label: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
        checked ? 'bg-green-500' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export function EventEditorModal({
  isOpen,
  isEditing,
  errorMessage,
  saving,
  deleting,
  formState,
  setFormState,
  midiSongs,
  logos,
  midiSet,
  logoSet,
  onClose,
  onSave,
  onDelete,
}: EventEditorModalProps) {
  if (!isOpen) return null;

  const blocked = saving || deleting;

  return (
    <div className="modal-overlay">
      <div className="modal-panel modal-panel-xl">
        <h3 className="text-lg font-bold mb-4">
          {isEditing ? 'Muokkaa tapahtumaa' : 'Lisää tapahtuma'}
        </h3>
        {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

        <div className="space-y-4">
          <div>
            <label htmlFor="eventName" className="form-label">
              Nimi
            </label>
            <Input
              id="eventName"
              value={formState.name}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="esim. Joulu 2026"
            />
          </div>

          <div className="flex items-center justify-between gap-3 px-1 py-1">
            <div>
              <p className="font-medium text-gray-800">Ajanjakso</p>
              <p className="text-muted-sm">
                {formState.dateRangeEnabled ? 'Alku- ja loppupäivä käytössä' : 'Yksittäinen päivä käytössä'}
              </p>
            </div>
            <ToggleSwitch
              id="eventDateRangeEnabled"
              checked={formState.dateRangeEnabled}
              onClick={() =>
                setFormState((prev) => ({
                  ...prev,
                  dateRangeEnabled: !prev.dateRangeEnabled,
                }))
              }
              disabled={blocked}
              label="Date range"
            />
          </div>

          {!formState.dateRangeEnabled && (
            <div>
              <label htmlFor="eventDate" className="form-label">
                Päivä
              </label>
              <Input
                id="eventDate"
                type="date"
                value={formState.eventDate}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, eventDate: event.target.value }))
                }
              />
            </div>
          )}

          {formState.dateRangeEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="eventRangeStartDate" className="form-label">
                  Alkaa
                </label>
                <Input
                  id="eventRangeStartDate"
                  type="date"
                  value={formState.rangeStartDate}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, rangeStartDate: event.target.value }))
                  }
                />
              </div>
              <div>
                <label htmlFor="eventRangeEndDate" className="form-label">
                  Päättyy
                </label>
                <Input
                  id="eventRangeEndDate"
                  type="date"
                  value={formState.rangeEndDate}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, rangeEndDate: event.target.value }))
                  }
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 px-1 py-1">
            <div>
              <p className="font-medium text-gray-800">Toistuu vuosittain</p>
              <p className="text-muted-sm">
                {formState.repeatsYearly ? 'Tapahtuma toistuu joka vuosi' : 'Tapahtuma on kertaluonteinen'}
              </p>
            </div>
            <ToggleSwitch
              id="eventRepeatsYearly"
              checked={formState.repeatsYearly}
              onClick={() =>
                setFormState((prev) => ({
                  ...prev,
                  repeatsYearly: !prev.repeatsYearly,
                }))
              }
              disabled={blocked}
              label="Toistuu vuosittain"
            />
          </div>

          <section className="section-block">
            <h4 className="section-header">Tiedostot</h4>

            <div>
              <label htmlFor="eventMusicFile" className="form-label">
                <span className="inline-flex items-center gap-1">
                  <Music2 size={16} />
                  MIDI-tiedosto
                </span>
              </label>
              <select
                id="eventMusicFile"
                value={formState.musicFile}
                disabled={blocked}
                onChange={(event) => setFormState((prev) => ({ ...prev, musicFile: event.target.value }))}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded focus:border-yellow-400 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">Ei midi-tiedostoa</option>
                {midiSongs.map((song) => (
                  <option key={song} value={song}>
                    {song}
                  </option>
                ))}
              </select>
              <p className="text-muted-xs mt-1">
                Löydetty {midiSongs.length} MIDI-tiedostoa kansiosta `public/midi`.
              </p>
              {!formState.musicEnabled && (
                <p className="text-muted-xs mt-1">
                  Tiedosto tallennetaan valmiiksi, mutta sitä käytetään vain jos musiikki on päällä.
                </p>
              )}
              {midiSongs.length === 0 && (
                <p className="text-error-xs">
                  MIDI-tiedostoja ei löytynyt kansiosta `public/midi`.
                </p>
              )}
              {formState.musicEnabled && formState.musicFile && !midiSet.has(formState.musicFile) && (
                <p className="text-error-xs">Valittu MIDI puuttuu kansiosta `public/midi`.</p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 px-1 py-1">
              <div>
                <p className="font-medium text-gray-800">Midin soittaminen</p>
                <p className="text-muted-sm">
                  {formState.musicEnabled ? 'MIDI soi tapahtuman aikana' : 'MIDI ei soi tapahtuman aikana'}
                </p>
              </div>
              <ToggleSwitch
                id="eventMusicEnabled"
                checked={formState.musicEnabled}
                onClick={() =>
                  setFormState((prev) => ({
                    ...prev,
                    musicEnabled: !prev.musicEnabled,
                  }))
                }
                disabled={blocked}
                label="Tapahtuman musiikki"
              />
            </div>

            <div className="mt-4">
              <label htmlFor="eventLogoFile" className="form-label">
                <span className="inline-flex items-center gap-1">
                  <ImageIcon size={16} />
                  Logo
                </span>
              </label>
              <select
                id="eventLogoFile"
                value={formState.logoFile}
                disabled={blocked}
                onChange={(event) => setFormState((prev) => ({ ...prev, logoFile: event.target.value }))}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded focus:border-yellow-400 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">Ei logoa</option>
                {logos.map((logo) => (
                  <option key={logo} value={logo}>
                    {logo}
                  </option>
                ))}
              </select>
              <p className="text-muted-xs mt-1">
                Löydetty {logos.length} logotiedostoa kansiosta `public/logo`.
              </p>
              {formState.logoEnabled && formState.logoFile && !logoSet.has(formState.logoFile) && (
                <p className="text-error-xs">Valittu logo puuttuu kansiosta `public/logo`.</p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 px-1 py-1">
              <div>
                <p className="font-medium text-gray-800">Logon näyttäminen</p>
                <p className="text-muted-sm">
                  {formState.logoEnabled ? 'Logo näytetään tapahtuman aikana' : 'Logoa ei näytetä tapahtuman aikana'}
                </p>
              </div>
              <ToggleSwitch
                id="eventLogoEnabled"
                checked={formState.logoEnabled}
                onClick={() =>
                  setFormState((prev) => ({
                    ...prev,
                    logoEnabled: !prev.logoEnabled,
                  }))
                }
                disabled={blocked}
                label="Tapahtuman logo"
              />
            </div>
          </section>
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <div>
            {isEditing && (
              <Button
                type="button"
                variant="danger"
                onClick={onDelete}
                disabled={blocked}
              >
                {deleting ? 'Poistetaan...' : 'Poista'}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={blocked}>
              Peruuta
            </Button>
            <Button type="button" variant="primary" onClick={onSave} disabled={blocked}>
              {saving ? 'Tallennetaan...' : 'Tallenna'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
