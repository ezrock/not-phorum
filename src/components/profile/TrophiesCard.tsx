import { Card } from '@/components/ui/Card';
import { Trophy as TrophyIcon } from 'lucide-react';
import { trophyLocalIconUrl } from '@/lib/trophies';
import type { Trophy } from '@/lib/trophies';

interface TrophiesCardProps {
  trophies: Trophy[];
}

export function TrophiesCard({ trophies }: TrophiesCardProps) {
  return (
    <Card className="mb-6">
      <h2 className="card-title flex items-center gap-2">
        <TrophyIcon size={20} className="text-yellow-600" />
        Kunniamerkit
      </h2>
      {trophies.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {trophies.map((trophy) => (
            <span
              key={trophy.id}
              className="inline-flex items-center rounded bg-yellow-100 text-yellow-800 px-2 py-1 text-xs font-medium"
              title={`${trophy.name} (${trophy.points} p)`}
            >
              {trophyLocalIconUrl(trophy.icon_path) && (
                <img
                  src={trophyLocalIconUrl(trophy.icon_path) as string}
                  alt={trophy.name}
                  className="w-4 h-5 object-contain mr-1"
                />
              )}
              {trophy.name}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">Ei kunniamerkkejä vielä.</p>
      )}
    </Card>
  );
}
