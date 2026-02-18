'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { CalendarDays, Music2, Image as ImageIcon } from 'lucide-react';
import { UI_ICON_SETTINGS } from '@/lib/uiSettings';
import { useAuth } from '@/contexts/AuthContext';

interface SiteEvent {
  id: number;
  name: string;
  event_date: string;
  date_range_enabled: boolean;
  range_start_date: string | null;
  range_end_date: string | null;
  music_enabled: boolean;
  music_file: string | null;
  logo_enabled: boolean;
  logo_file: string | null;
}

interface EventFormState {
  name: string;
  eventDate: string;
  dateRangeEnabled: boolean;
  rangeStartDate: string;
  rangeEndDate: string;
  musicEnabled: boolean;
  musicFile: string;
  logoEnabled: boolean;
  logoFile: string;
}

const EMPTY_FORM: EventFormState = {
  name: '',
  eventDate: '',
  dateRangeEnabled: false,
  rangeStartDate: '',
  rangeEndDate: '',
  musicEnabled: false,
  musicFile: '',
  logoEnabled: false,
  logoFile: '',
};

function formatEventDate(dateValue: string): string {
  if (!dateValue) return '-';
  const date = new Date(`${dateValue}T00:00:00`);
  return new Intl.DateTimeFormat('fi-FI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatMidiName(fileName: string | null): string {
  if (!fileName) return 'No midi file';
  return fileName.replace(/\.(mid|midi)$/i, '');
}

function formatDateCell(event: SiteEvent): string {
  if (event.date_range_enabled && event.range_start_date && event.range_end_date) {
    return `${formatEventDate(event.range_start_date)} - ${formatEventDate(event.range_end_date)}`;
  }
  return formatEventDate(event.event_date);
}

function formatDbError(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;

  const maybe = error as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  };

  if (maybe.code === '42P01') {
    return 'Tietokantataulu `site_events` puuttuu. Aja migraatio `024_site_events.sql`.';
  }

  if (maybe.code === '42703') {
    return 'Taulusta puuttuu uusia tapahtumakenttiä. Aja migraatiot `025_site_events_logo_toggle.sql` ja `026_site_events_date_range.sql`.';
  }

  if (maybe.code === '42501') {
    return 'Ei oikeuksia tallentaa tapahtumaa (RLS/politiikka).';
  }

  if (maybe.code === '23502') {
    return `Pakollinen kenttä puuttuu (${maybe.details || maybe.message || 'NOT NULL'}).`;
  }

  const extra = [maybe.details, maybe.hint].filter(Boolean).join(' ');
  return [maybe.message || fallback, extra].filter(Boolean).join(' ');
}

export function EventsPanel() {
  const { supabase } = useAuth();
  const showHeaderIcons = UI_ICON_SETTINGS.showHeaderIcons;

  const [events, setEvents] = useState<SiteEvent[]>([]);
  const [midiSongs, setMidiSongs] = useState<string[]>([]);
  const [logos, setLogos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [formState, setFormState] = useState<EventFormState>(EMPTY_FORM);

  const midiSet = useMemo(() => new Set(midiSongs), [midiSongs]);
  const logoSet = useMemo(() => new Set(logos), [logos]);
  const editingEvent = useMemo(
    () => events.find((event) => event.id === editingEventId) ?? null,
    [editingEventId, events]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    const [eventsRes, assetsRes] = await Promise.allSettled([
      supabase
        .from('site_events')
        .select('id, name, event_date, date_range_enabled, range_start_date, range_end_date, music_enabled, music_file, logo_enabled, logo_file')
        .order('event_date', { ascending: false })
        .order('name', { ascending: true }),
      fetch('/api/events/assets', { cache: 'no-store' }),
    ]);

    if (eventsRes.status === 'fulfilled') {
      if (eventsRes.value.error) {
        setEvents([]);
        setErrorMessage(eventsRes.value.error.message || 'Tapahtumien lataus epäonnistui');
      } else {
        setEvents((eventsRes.value.data ?? []) as SiteEvent[]);
      }
    } else {
      setEvents([]);
      setErrorMessage(eventsRes.reason instanceof Error ? eventsRes.reason.message : 'Tapahtumien lataus epäonnistui');
    }

    if (assetsRes.status === 'fulfilled') {
      if (assetsRes.value.ok) {
        const assetsData = (await assetsRes.value.json()) as { midiSongs?: string[]; logos?: string[] };
        setMidiSongs(Array.isArray(assetsData.midiSongs) ? assetsData.midiSongs : []);
        setLogos(Array.isArray(assetsData.logos) ? assetsData.logos : []);
      } else {
        setMidiSongs([]);
        setLogos([]);
        setErrorMessage((prev) => prev || 'Tiedostolistojen haku epäonnistui.');
      }
    } else {
      setMidiSongs([]);
      setLogos([]);
      setErrorMessage((prev) => prev || 'Tiedostolistojen haku epäonnistui.');
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingEventId(null);
    setFormState(EMPTY_FORM);
    setIsModalOpen(true);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const openEditModal = (event: SiteEvent) => {
    setEditingEventId(event.id);
    setFormState({
      name: event.name,
      eventDate: event.event_date,
      dateRangeEnabled: event.date_range_enabled,
      rangeStartDate: event.range_start_date ?? '',
      rangeEndDate: event.range_end_date ?? '',
      musicEnabled: event.music_enabled,
      musicFile: event.music_file ?? '',
      logoEnabled: event.logo_enabled,
      logoFile: event.logo_file ?? '',
    });
    setIsModalOpen(true);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const closeModal = () => {
    if (saving || deleting) return;
    setIsModalOpen(false);
  };

  const handleSave = async () => {
    const trimmedName = formState.name.trim();
    if (!trimmedName) {
      setErrorMessage('Tapahtuman nimi on pakollinen.');
      return;
    }
    if (!formState.dateRangeEnabled && !formState.eventDate) {
      setErrorMessage('Päivämäärä on pakollinen.');
      return;
    }
    if (formState.dateRangeEnabled && (!formState.rangeStartDate || !formState.rangeEndDate)) {
      setErrorMessage('Valitse alku- ja loppupäivä päivämäärävälille.');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    const normalizedMusicFile = formState.musicFile.trim();
    const normalizedLogoFile = formState.logoFile.trim();
    const normalizedRangeStart = formState.rangeStartDate.trim();
    const normalizedRangeEnd = formState.rangeEndDate.trim();
    const effectiveEventDate = formState.dateRangeEnabled ? normalizedRangeStart : formState.eventDate;

    const payload = {
      name: trimmedName,
      event_date: effectiveEventDate,
      date_range_enabled: formState.dateRangeEnabled,
      range_start_date: formState.dateRangeEnabled ? normalizedRangeStart : null,
      range_end_date: formState.dateRangeEnabled ? normalizedRangeEnd : null,
      music_enabled: formState.musicEnabled,
      music_file: normalizedMusicFile || null,
      logo_enabled: formState.logoEnabled,
      logo_file: normalizedLogoFile || null,
    };

    try {
      if (editingEventId === null) {
        const { error } = await supabase.from('site_events').insert(payload);
        if (error) throw error;
        setSuccessMessage('Tapahtuma lisätty.');
      } else {
        const { error } = await supabase.from('site_events').update(payload).eq('id', editingEventId);
        if (error) throw error;
        setSuccessMessage('Tapahtuma päivitetty.');
      }

      setIsModalOpen(false);
      await loadData();
    } catch (error: unknown) {
      const message = formatDbError(error, 'Tallennus epäonnistui');
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingEventId) return;
    const confirmed = window.confirm('Poistetaanko tapahtuma pysyvästi?');
    if (!confirmed) return;

    setDeleting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.from('site_events').delete().eq('id', editingEventId);
      if (error) throw error;

      setIsModalOpen(false);
      setSuccessMessage('Tapahtuma poistettu.');
      await loadData();
    } catch (error: unknown) {
      const message = formatDbError(error, 'Poisto epäonnistui');
      setErrorMessage(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="card-title mb-0 flex items-center gap-2">
          {showHeaderIcons && <CalendarDays size={20} className="text-yellow-600" />}
          Tapahtumat
        </h2>
        <Button type="button" variant="primary" onClick={openCreateModal}>
          Lisää tapahtuma
        </Button>
      </div>

      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      {loading ? (
        <p className="text-sm text-gray-500">Ladataan tapahtumia...</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-gray-500">Ei tapahtumia vielä.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Nimi</th>
                <th className="px-3 py-2 font-semibold">Päivä</th>
                <th className="px-3 py-2 font-semibold">MIDI</th>
                <th className="px-3 py-2 font-semibold">Logo</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const musicMissing = !!event.music_enabled && !!event.music_file && !midiSet.has(event.music_file);
                const logoMissing = !!event.logo_enabled && !!event.logo_file && !logoSet.has(event.logo_file);

                return (
                  <tr
                    key={event.id}
                    className="border-t border-gray-100 hover:bg-yellow-50/40 cursor-pointer"
                    onClick={() => openEditModal(event)}
                  >
                    <td className="px-3 py-2 font-medium">{event.name}</td>
                    <td className="px-3 py-2">
                      {formatDateCell(event)}
                      {event.date_range_enabled && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">Range</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-1 rounded ${event.music_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                          {event.music_enabled ? 'On' : 'Off'}
                        </span>
                        <span>{formatMidiName(event.music_file)}</span>
                        {musicMissing && <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">Missing</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-1 rounded ${event.logo_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                          {event.logo_enabled ? 'On' : 'Off'}
                        </span>
                        <span>{event.logo_file || 'No logo file'}</span>
                        {logoMissing && <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">Missing</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-xl rounded-xl border-2 border-gray-800 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold mb-4">
              {editingEvent ? 'Muokkaa tapahtumaa' : 'Lisää tapahtuma'}
            </h3>
            {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

            <div className="space-y-4">
              <div>
                <label htmlFor="eventName" className="block text-sm font-medium mb-1">
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

              <div>
                <label htmlFor="eventDateRangeEnabled" className="flex items-center gap-2 text-sm font-medium">
                  <input
                    id="eventDateRangeEnabled"
                    type="checkbox"
                    checked={formState.dateRangeEnabled}
                    disabled={saving || deleting}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        dateRangeEnabled: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 border-gray-300 rounded"
                  />
                  Date range
                </label>
              </div>

              {!formState.dateRangeEnabled && (
                <div>
                  <label htmlFor="eventDate" className="block text-sm font-medium mb-1">
                    Päivämäärä
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
                    <label htmlFor="eventRangeStartDate" className="block text-sm font-medium mb-1">
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
                    <label htmlFor="eventRangeEndDate" className="block text-sm font-medium mb-1">
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

              <div>
                <label htmlFor="eventMusicFile" className="block text-sm font-medium mb-1">
                  <span className="inline-flex items-center gap-1">
                    <Music2 size={16} />
                    MIDI-tiedosto
                  </span>
                </label>
                <select
                  id="eventMusicFile"
                  value={formState.musicFile}
                  disabled={saving || deleting}
                  onChange={(event) => setFormState((prev) => ({ ...prev, musicFile: event.target.value }))}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded focus:border-yellow-400 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">No midi file</option>
                  {midiSongs.map((song) => (
                    <option key={song} value={song}>
                      {song}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Löydetty {midiSongs.length} MIDI-tiedostoa kansiosta `public/midi`.
                </p>
                {!formState.musicEnabled && (
                  <p className="text-xs text-gray-500 mt-1">
                    Tiedosto tallennetaan valmiiksi, mutta sitä käytetään vain jos musiikki on päällä.
                  </p>
                )}
                {midiSongs.length === 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    MIDI-tiedostoja ei löytynyt kansiosta `public/midi`.
                  </p>
                )}
                {formState.musicEnabled && formState.musicFile && !midiSet.has(formState.musicFile) && (
                  <p className="text-xs text-red-600 mt-1">Valittu MIDI puuttuu kansiosta `public/midi`.</p>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 px-1 py-1">
                <label htmlFor="eventMusicEnabled" className="text-md text-gray-700">
                  Musiikki päällä
                </label>

                <button
                  id="eventMusicEnabled"
                  type="button"
                  role="switch"
                  aria-checked={formState.musicEnabled}
                  aria-label="Tapahtuman musiikki"
                  disabled={saving || deleting}
                  onClick={() =>
                    setFormState((prev) => ({
                      ...prev,
                      musicEnabled: !prev.musicEnabled,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    formState.musicEnabled ? 'bg-yellow-500' : 'bg-gray-300'
                  } ${(saving || deleting) ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      formState.musicEnabled ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label htmlFor="eventLogoFile" className="block text-sm font-medium mb-1">
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon size={16} />
                    Logo
                  </span>
                </label>
                <select
                  id="eventLogoFile"
                  value={formState.logoFile}
                  disabled={saving || deleting}
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
                <p className="text-xs text-gray-500 mt-1">
                  Löydetty {logos.length} logotiedostoa kansiosta `public/logo`.
                </p>
                {formState.logoEnabled && formState.logoFile && !logoSet.has(formState.logoFile) && (
                  <p className="text-xs text-red-600 mt-1">Valittu logo puuttuu kansiosta `public/logo`.</p>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 px-1 py-1">
                <label htmlFor="eventLogoEnabled" className="text-md text-gray-700">
                  Logo päällä
                </label>

                <button
                  id="eventLogoEnabled"
                  type="button"
                  role="switch"
                  aria-checked={formState.logoEnabled}
                  aria-label="Tapahtuman logo"
                  disabled={saving || deleting}
                  onClick={() =>
                    setFormState((prev) => ({
                      ...prev,
                      logoEnabled: !prev.logoEnabled,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    formState.logoEnabled ? 'bg-yellow-500' : 'bg-gray-300'
                  } ${(saving || deleting) ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      formState.logoEnabled ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-2">
              <div>
                {editingEvent && (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={handleDelete}
                    disabled={saving || deleting}
                  >
                    {deleting ? 'Poistetaan...' : 'Poista'}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={closeModal} disabled={saving || deleting}>
                  Peruuta
                </Button>
                <Button type="button" variant="primary" onClick={handleSave} disabled={saving || deleting}>
                  {saving ? 'Tallennetaan...' : 'Tallenna'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
