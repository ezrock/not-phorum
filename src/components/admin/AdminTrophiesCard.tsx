import { Trophy } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { trophyLocalIconUrl } from '@/lib/trophies';
import type { TrophyOverview } from '@/components/admin/useAdminPageState';

interface AdminTrophiesCardProps {
  showHeaderIcons: boolean;
  trophyOverview: TrophyOverview[];
  totalAwardedTrophies: number;
}

export function AdminTrophiesCard({
  showHeaderIcons,
  trophyOverview,
  totalAwardedTrophies,
}: AdminTrophiesCardProps) {
  return (
    <Card>
      <div className="section-head-row">
        {showHeaderIcons && <Trophy size={24} className="text-yellow-600" />}
        <h2 className="card-title mb-0">Pokaalit (Legacy baseline)</h2>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Tunnistettu {trophyOverview.length} uniikkia kunniamerkkiä. Jaettuja merkkejä yhteensä {totalAwardedTrophies}.
      </p>

      <div className="space-y-2">
        {trophyOverview.slice(0, 20).map((trophy) => (
          <div key={trophy.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-2">
            <div className="min-w-0 flex items-center gap-2">
              {trophyLocalIconUrl(trophy.icon_path) && (
                <img
                  src={trophyLocalIconUrl(trophy.icon_path) as string}
                  alt={trophy.name}
                  className="w-4 h-5 object-contain flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="font-semibold truncate">{trophy.name}</p>
                <p className="text-muted-xs truncate">{trophy.code}</p>
              </div>
            </div>
            <div className="text-right ml-4">
              <p className="text-sm font-bold text-yellow-700">{trophy.points} p</p>
              <p className="text-muted-xs">{trophy.awarded_count} käyttäjällä</p>
            </div>
          </div>
        ))}
      </div>

      {trophyOverview.length > 20 && (
        <p className="mt-4 text-muted-xs">
          Näytetään 20 ensimmäistä. Loput löytyvät taulusta `admin_trophy_overview`.
        </p>
      )}
    </Card>
  );
}
