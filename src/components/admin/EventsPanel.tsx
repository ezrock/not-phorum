'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/Alert';
import { CalendarDays } from 'lucide-react';
import { UI_ICON_SETTINGS } from '@/lib/uiSettings';
import { useAuth } from '@/contexts/AuthContext';
import { EventEditorModal } from '@/components/admin/events/EventEditorModal';
import { EventsTable } from '@/components/admin/events/EventsTable';
import { EMPTY_FORM, type EventFormState, type SiteEvent } from '@/components/admin/events/types';

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
        .select('id, name, event_date, repeats_yearly, date_range_enabled, range_start_date, range_end_date, music_enabled, music_file, logo_enabled, logo_file')
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
      repeatsYearly: event.repeats_yearly !== false,
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
      setErrorMessage('Valitse alku- ja loppupäivämäärä.');
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
      repeats_yearly: formState.repeatsYearly,
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
        <EventsTable
          events={events}
          midiSet={midiSet}
          logoSet={logoSet}
          onEdit={openEditModal}
          formatDateCell={formatDateCell}
          formatMidiName={formatMidiName}
        />
      )}
      <EventEditorModal
        isOpen={isModalOpen}
        isEditing={editingEvent !== null}
        errorMessage={errorMessage}
        saving={saving}
        deleting={deleting}
        formState={formState}
        setFormState={setFormState}
        midiSongs={midiSongs}
        logos={logos}
        midiSet={midiSet}
        logoSet={logoSet}
        onClose={closeModal}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </Card>
  );
}
