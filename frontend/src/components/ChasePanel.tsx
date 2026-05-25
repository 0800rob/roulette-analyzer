import { ChaseStatus } from '../api';
import { getNumberColor } from '../constants';

interface Props {
  str1: ChaseStatus;
  str2: ChaseStatus;
}

function fillColor(num: number): string {
  switch (getNumberColor(num)) {
    case 'red':
      return '#c8102e';
    case 'black':
      return '#1a1a1a';
    case 'green':
      return '#047857';
  }
}

function Bubble({ num, big = false }: { num: number; big?: boolean }) {
  const size = big ? 36 : 24;
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: fillColor(num),
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: big ? 16 : 11,
        border: '1px solid rgba(255,255,255,0.2)',
        flexShrink: 0,
      }}
    >
      {num}
    </span>
  );
}

function ChaseSlot({
  status,
  label,
  accent,
}: {
  status: ChaseStatus;
  label: string;
  accent: string;
}) {
  const isIdle = status.status === 'idle';
  const isActive = status.status === 'active';
  const isResolved = status.status === 'resolved';

  // Hit number = the one that resolved. For STR1 we also know the original
  // 3 cheios (hit_numbers). For STR2 hit_numbers is the full monitored set.
  const primary = status.hit_numbers ?? [];
  const allMarked = status.marked_numbers ?? [];
  // Neighbours/extras = marked but not in primary (only meaningful for STR1)
  const extras = allMarked.filter((n) => !primary.includes(n));

  return (
    <div
      style={{
        flex: 1,
        minWidth: 280,
        border: `2px solid ${
          isResolved ? '#22c55e' : isActive ? accent : '#2a2a2a'
        }`,
        borderRadius: 8,
        padding: 14,
        background: isResolved
          ? 'linear-gradient(180deg, #062b1f 0%, #041a13 100%)'
          : isActive
          ? '#0a0a0a'
          : '#0a0a0a',
        transition: 'border-color 0.3s, background 0.3s',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <span style={{ color: accent, fontWeight: 700, letterSpacing: 1 }}>
          {label}
        </span>
        <span
          style={{
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 99,
            border: `1px solid ${
              isResolved ? '#22c55e' : isActive ? accent : '#444'
            }`,
            color: isResolved ? '#22c55e' : isActive ? accent : '#666',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          {isResolved ? '🎯 atingido' : isActive ? 'perseguindo' : 'aguardando'}
        </span>
      </div>

      {/* Idle */}
      {isIdle && (
        <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
          Nenhum gatilho ativo. Aguardando próximo padrão.
        </p>
      )}

      {/* Active */}
      {isActive && (
        <>
          <div
            style={{
              fontSize: 12,
              color: '#888',
              marginBottom: 6,
              display: 'flex',
              gap: 6,
              alignItems: 'center',
            }}
          >
            Disparou em
            {status.started_spin_number !== null &&
              status.started_spin_number !== undefined && (
                <Bubble num={status.started_spin_number} />
              )}
            <span>· seguindo há {status.spins_followed} giros</span>
          </div>

          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
            Aposta nestes números (
            {primary.length > 0 ? primary.length : allMarked.length} principais +
            {' '}
            {extras.length} vizinhos):
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {(primary.length > 0 ? primary : allMarked).map((n) => (
              <Bubble key={`p-${n}`} num={n} big />
            ))}
          </div>
          {extras.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {extras.map((n) => (
                <Bubble key={`e-${n}`} num={n} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Resolved */}
      {isResolved && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#22c55e',
              letterSpacing: 1,
              textAlign: 'center',
              padding: '8px 0',
            }}
          >
            🎯 ALVO ATINGIDO!
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 13,
              color: '#ddd',
            }}
          >
            <span>Caiu em</span>
            {status.resolved_spin_number !== null &&
              status.resolved_spin_number !== undefined && (
                <Bubble num={status.resolved_spin_number} big />
              )}
            <span>após {status.spins_followed} giros</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChasePanel({ str1, str2 }: Props) {
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <h2 style={{ margin: 0, marginBottom: 12 }}>🎯 Perseguição de gatilhos</h2>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <ChaseSlot status={str1} label="STR 1 — RUGAL" accent="#c9a96e" />
        <ChaseSlot status={str2} label="STR 2 — MONITOR" accent="#00d4ff" />
      </div>
    </div>
  );
}
