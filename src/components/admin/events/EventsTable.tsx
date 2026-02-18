import type { SiteEvent } from '@/components/admin/events/types';

interface EventsTableProps {
  events: SiteEvent[];
  midiSet: Set<string>;
  logoSet: Set<string>;
  onEdit: (event: SiteEvent) => void;
  formatDateCell: (event: SiteEvent) => string;
  formatMidiName: (fileName: string | null) => string;
}

export function EventsTable({
  events,
  midiSet,
  logoSet,
  onEdit,
  formatDateCell,
  formatMidiName,
}: EventsTableProps) {
  return (
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
                onClick={() => onEdit(event)}
              >
                <td className="px-3 py-2 font-medium">{event.name}</td>
                <td className="px-3 py-2">
                  {formatDateCell(event)}
                  {event.date_range_enabled && (
                    <span className="ml-2 text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">Jakso</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-1 rounded ${event.music_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                      {event.music_enabled ? 'On' : 'Off'}
                    </span>
                    <span>{formatMidiName(event.music_file)}</span>
                    {musicMissing && <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">Puuttuu</span>}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-1 rounded ${event.logo_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                      {event.logo_enabled ? 'On' : 'Off'}
                    </span>
                    <span>{event.logo_file || 'No logo file'}</span>
                    {logoMissing && <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">Puuttuu</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
