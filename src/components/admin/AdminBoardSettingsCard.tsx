import { ScrollText, Settings2, UserPlus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/button';

interface AdminBoardSettingsCardProps {
  showHeaderIcons: boolean;
  registrationEnabled: boolean;
  toggling: boolean;
  notificationEnabled: boolean;
  notificationToggling: boolean;
  notificationMessage: string;
  savingNotificationMessage: boolean;
  onToggleRegistration: () => void;
  onToggleNotification: () => void;
  onNotificationMessageChange: (value: string) => void;
  onSaveNotificationMessage: () => void;
}

export function AdminBoardSettingsCard({
  showHeaderIcons,
  registrationEnabled,
  toggling,
  notificationEnabled,
  notificationToggling,
  notificationMessage,
  savingNotificationMessage,
  onToggleRegistration,
  onToggleNotification,
  onNotificationMessageChange,
  onSaveNotificationMessage,
}: AdminBoardSettingsCardProps) {
  return (
    <Card>
      <div className="section-head-row">
        {showHeaderIcons && <Settings2 size={24} className="text-yellow-600" />}
        <h2 className="card-title mb-0">Boardin asetukset</h2>
      </div>

      <div className="flex items-center justify-between px-3">
        <div className="flex items-center gap-3">
          <UserPlus size={20} className="text-gray-600" />
          <div>
            <p className="font-medium">Rekisteröityminen</p>
            <p className="text-muted-sm">{registrationEnabled ? 'Portit auki.' : 'Portit kiinni.'}</p>
          </div>
        </div>
        <button
          onClick={onToggleRegistration}
          disabled={toggling}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
            registrationEnabled ? 'bg-green-500' : 'bg-gray-300'
          } ${toggling ? 'opacity-50' : ''}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
              registrationEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="section-block">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ScrollText size={20} className="text-gray-600" />
            <div>
              <p className="font-medium">Ilmoitusraita</p>
              <p className="text-muted-sm">
                {notificationEnabled ? 'Raita näkyy kirjautuneille käyttäjille' : 'Raita on pois päältä'}
              </p>
            </div>
          </div>
          <button
            onClick={onToggleNotification}
            disabled={notificationToggling}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
              notificationEnabled ? 'bg-green-500' : 'bg-gray-300'
            } ${notificationToggling ? 'opacity-50' : ''}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                notificationEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="mt-4">
          <label htmlFor="notificationMessage" className="block text-sm text-gray-700 mb-1">
            Ilmoitusviesti
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="notificationMessage"
              value={notificationMessage}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNotificationMessageChange(e.target.value)}
              placeholder="Kirjoita ilmoitusviesti..."
            />
            <Button
              type="button"
              variant="primary"
              onClick={onSaveNotificationMessage}
              disabled={savingNotificationMessage}
            >
              {savingNotificationMessage ? 'Tallennetaan...' : 'Tallenna'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
