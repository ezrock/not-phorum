'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export default function PendingApprovalPage() {
  const { profile, logout } = useAuth();
  const approvalStatus = (profile as { approval_status?: string } | null)?.approval_status ?? 'pending';
  const isRejected = approvalStatus === 'rejected';

  return (
    <div className="page-container">
      <Card className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">
          {isRejected ? 'Jäsenhakemus hylätty' : 'Jäsenhakemus odottaa hyväksyntää'}
        </h1>
        <p className="text-gray-600">
          {isRejected
            ? 'Ylläpito ei hyväksynyt rekisteröitymistä tällä kertaa.'
            : 'Ylläpito tarkistaa rekisteröitymisen. Saat pääsyn foorumille, kun hakemus on hyväksytty.'}
        </p>
        <div className="mt-6">
          <Button type="button" variant="outline" onClick={logout}>
            Kirjaudu ulos
          </Button>
        </div>
      </Card>
    </div>
  );
}
