import { useEffect, useState } from 'react';
import { LiveTableInfo, listLiveTables, setSessionLive } from '../api';

interface Props {
  sessionId: number;
  liveTable: string | null | undefined;
  onLiveChanged: (newTable: string | null) => void;
}

export default function LivePanel({
  sessionId,
  liveTable,
  onLiveChanged,
}: Props) {
  const [tables, setTables] = useState<LiveTableInfo[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listLiveTables()
      .then((r) => setTables(r.data))
      .catch((e) => console.error('listLiveTables failed', e));
  }, []);

  const enableLive = async (table: string) => {
    setBusy(true);
    try {
      const r = await setSessionLive(sessionId, table);
      onLiveChanged(r.data.live_table ?? null);
    } finally {
      setBusy(false);
    }
  };

  const disableLive = async () => {
    setBusy(true);
    try {
      const r = await setSessionLive(sessionId, null);
      onLiveChanged(r.data.live_table ?? null);
    } finally {
      setBusy(false);
    }
  };

  const isLive = !!liveTable;

  return (
    <div className="card" style={{ marginBottom: 0, padding: '12px 18px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 13 }}>📡 Alimentação ao vivo</h2>
          {isLive && (
            <span
              style={{
                fontSize: 11,
                color: '#0a0',
                border: '1px solid #0a0',
                borderRadius: 99,
                padding: '2px 8px',
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              ● AO VIVO
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tables.map((t) => (
            <button
              key={t.key}
              disabled={busy}
              onClick={() => enableLive(t.key)}
              className={liveTable === t.key ? 'btn-primary' : 'btn-secondary'}
              style={{ fontSize: 12 }}
            >
              {t.label}
            </button>
          ))}
          {isLive && (
            <button
              onClick={disableLive}
              disabled={busy}
              className="btn-danger"
              style={{ fontSize: 12 }}
            >
              Parar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
