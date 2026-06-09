import { useState, useEffect, useCallback } from 'react';
import {
  Session,
  SessionStats,
  Spin,
  Prediction,
  GroupStrategyResponse,
  ChaseStatus,
  ChaseStatusResponse,
  ChaseHistoryResponse,
  addSpin,
  undoLastSpin,
  getStats,
  getSpins,
  getPredictions,
  getGroupStrategy,
  getChaseStatus,
  getChaseHistory,
} from '../api';
import BettingTable from './BettingTable';
import Racetrack from './Racetrack';
import HistoryGrid from './HistoryGrid';
import PredictionPanel from './PredictionPanel';
import GroupStrategyPanel from './GroupStrategyPanel';
import LivePanel from './LivePanel';
import ChasePanel from './ChasePanel';
import ChaseHistoryPanel from './ChaseHistoryPanel';
import FrequencyChart from './FrequencyChart';
import StatsPanel from './StatsPanel';
import HeatMap from './HeatMap';
import { getNumberColor } from '../constants';

interface Props {
  session: Session;
}

/** Hot/cold list item used in the side panel. */
function HotColdItem({
  number,
  color,
  count,
}: {
  number: number;
  color: string;
  count: number;
}) {
  return (
    <div className="hot-cold-item">
      <span className={`num ${color}`}>{number}</span>
      <span className="count">{count}x</span>
    </div>
  );
}

/** Big "last result" display, mirroring the Evolution UI's BETS CLOSED bar. */
function LastResult({ number }: { number: number | null }) {
  if (number === null) {
    return (
      <div
        style={{
          background: 'linear-gradient(180deg, #2a0a0a 0%, #1a0606 100%)',
          color: '#666',
          textAlign: 'center',
          padding: '14px 0',
          letterSpacing: 4,
          fontWeight: 700,
          fontSize: 13,
          borderTop: '1px solid #c8102e',
          borderBottom: '1px solid #c8102e',
        }}
      >
        AGUARDANDO PRIMEIRO GIRO
      </div>
    );
  }

  const color = getNumberColor(number);
  const colorHex =
    color === 'red' ? '#c8102e' : color === 'black' ? '#1a1a1a' : '#047857';

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #c8102e 0%, #8a0a1f 100%)',
        color: '#fff',
        textAlign: 'center',
        padding: '6px 0',
        letterSpacing: 4,
        fontWeight: 700,
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
      }}
    >
      <span>ÚLTIMO RESULTADO</span>
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: colorHex,
          color: '#fff',
          border: '2px solid #fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          letterSpacing: 0,
        }}
      >
        {number}
      </span>
    </div>
  );
}

export default function Dashboard({ session }: Props) {
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [spinsAll, setSpinsAll] = useState<Spin[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastNumber, setLastNumber] = useState<number | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [predictionsLoading, setPredictionsLoading] = useState(false);
  const [minSpinsRequired] = useState(10);
  const [strategy, setStrategy] = useState<GroupStrategyResponse | null>(null);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [strategyWindow, setStrategyWindow] = useState(7);
  const [liveTable, setLiveTable] = useState<string | null>(session.live_table ?? null);
  const [chase, setChase] = useState<ChaseStatusResponse | null>(null);
  const [chaseHistory, setChaseHistory] = useState<ChaseHistoryResponse | null>(null);
  const isLive = !!liveTable;

  const loadPredictions = useCallback(async () => {
    setPredictionsLoading(true);
    try {
      const res = await getPredictions(session.id);
      setPredictions(res.data.predictions);
    } catch (err) {
      console.error('Failed to fetch predictions:', err);
    } finally {
      setPredictionsLoading(false);
    }
  }, [session.id]);

  const loadStrategy = useCallback(async () => {
    setStrategyLoading(true);
    try {
      const res = await getGroupStrategy(session.id, strategyWindow, 1);
      setStrategy(res.data);
    } catch (err) {
      console.error('Failed to fetch group strategy:', err);
    } finally {
      setStrategyLoading(false);
    }
  }, [session.id, strategyWindow]);

  const loadStats = useCallback(async () => {
    const res = await getStats(session.id);
    setStats(res.data);
    const last = res.data.last_10?.[res.data.last_10.length - 1];
    if (last) setLastNumber(last.number);
  }, [session.id]);

  const loadAllSpins = useCallback(async () => {
    try {
      const res = await getSpins(session.id);
      setSpinsAll(res.data);
    } catch (err) {
      console.error('Failed to fetch spins:', err);
    }
  }, [session.id]);

  const loadChase = useCallback(async () => {
    try {
      const res = await getChaseStatus(session.id);
      setChase(res.data);
    } catch (err) {
      console.error('Failed to fetch chase status:', err);
    }
  }, [session.id]);

  const loadChaseHistory = useCallback(async () => {
    try {
      const res = await getChaseHistory(session.id, 30);
      setChaseHistory(res.data);
    } catch (err) {
      console.error('Failed to fetch chase history:', err);
    }
  }, [session.id]);

  const refreshAll = useCallback(() => {
    loadStats();
    loadAllSpins();
    loadPredictions();
    loadStrategy();
    loadChase();
    loadChaseHistory();
  }, [
    loadStats,
    loadAllSpins,
    loadPredictions,
    loadStrategy,
    loadChase,
    loadChaseHistory,
  ]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(refreshAll, 5000);
    return () => clearInterval(id);
  }, [isLive, refreshAll]);

  const handleSpin = async (number: number) => {
    setLoading(true);
    await addSpin(session.id, number);
    setLastNumber(number);
    refreshAll();
    setLoading(false);
  };

  const handleUndo = async () => {
    await undoLastSpin(session.id);
    refreshAll();
  };

  const predictedNumbers = predictions.map((p) => p.number);

  // The mesa/race highlight follows the ACTIVE chase of STR1.
  // While idle or just-resolved, no marks are drawn on the board.
  const activeChase: ChaseStatus | null = chase ? chase.str1 : null;
  const chaseIsActive = !!activeChase && activeChase.status === 'active';
  const strategyMarked: number[] = chaseIsActive ? activeChase!.marked_numbers : [];
  const strategyHits: number[] = chaseIsActive
    ? activeChase!.hit_numbers.length > 0
      ? activeChase!.hit_numbers
      : activeChase!.marked_numbers
    : [];

  // Numbers (oldest -> newest) for the history grid
  const historyNumbers = spinsAll.map((s) => s.number);

  return (
    <div>
      {/* Session header bar */}
      <div className="session-header">
        <div>
          <div className="session-title">{session.name}</div>
          {session.casino && (
            <div className="session-meta">{session.casino}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="session-meta">
            Total: <strong style={{ color: '#c9a96e' }}>{stats?.total_spins ?? 0}</strong> giros
          </span>
          <button onClick={handleUndo} className="btn-danger" disabled={isLive}>
            ↩ Desfazer
          </button>
        </div>
      </div>

      {/* === Top section: history grid (right) — Evolution-style === */}
      <div className="top-section">
        <div className="card top-section-history">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <h2 style={{ margin: 0 }}>Histórico</h2>
            <span style={{ fontSize: 11, color: '#666' }}>
              {historyNumbers.length} giros
            </span>
          </div>
          <HistoryGrid numbers={historyNumbers} columns={12} maxSpins={132} />
        </div>
      </div>

      {/* === Bets-closed bar with last number === */}
      <LastResult number={lastNumber} />

      {/* === Main board: betting table + racetrack on the left, side panel right === */}
      <div className="board-layout" style={{ marginTop: 14 }}>
        <div>
          <div className="card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <BettingTable
                onSelect={handleSpin}
                disabled={loading || isLive}
                lastNumber={lastNumber}
                predictedNumbers={predictedNumbers}
                strategyMarkedNumbers={strategyMarked}
                strategyHitNumbers={strategyHits}
              />
              <Racetrack
                onSelect={handleSpin}
                disabled={loading || isLive}
                lastNumber={lastNumber}
                predictedNumbers={predictedNumbers}
                strategyMarkedNumbers={strategyMarked}
                strategyHitNumbers={strategyHits}
              />
              {isLive && (
                <p style={{ color: '#888', fontSize: 12, margin: 0 }}>
                  Modo ao vivo: clique nos números está desativado — os giros são
                  alimentados automaticamente.
                </p>
              )}
            </div>
          </div>

          <div className="prediction-panel-wrapper">
            <LivePanel
              sessionId={session.id}
              liveTable={liveTable}
              onLiveChanged={(t) => {
                setLiveTable(t);
                refreshAll();
              }}
            />
          </div>

          {chase && (
            <div className="prediction-panel-wrapper">
              <ChasePanel str1={chase.str1} />
            </div>
          )}

          {chaseHistory && (
            <div className="prediction-panel-wrapper">
              <ChaseHistoryPanel history={chaseHistory} />
            </div>
          )}

          <div className="prediction-panel-wrapper">
            <GroupStrategyPanel
              strategy={strategy}
              loading={strategyLoading}
              window={strategyWindow}
              onWindowChange={setStrategyWindow}
            />
          </div>

          <div className="prediction-panel-wrapper">
            <PredictionPanel
              predictions={predictions}
              totalSpins={stats?.total_spins ?? 0}
              minSpinsRequired={minSpinsRequired}
              loading={predictionsLoading}
            />
          </div>
        </div>

        {/* Side panel */}
        <div className="side-panel">
          {stats && stats.total_spins > 0 && (
            <>
              <div className="card">
                <h2>🔥 Quentes</h2>
                <div className="hot-cold-list">
                  {stats.hot_cold.hot.map((f) => (
                    <HotColdItem
                      key={`hot-${f.number}`}
                      number={f.number}
                      color={f.color}
                      count={f.count}
                    />
                  ))}
                </div>
              </div>

              <div className="card">
                <h2>❄️ Frios</h2>
                <div className="hot-cold-list">
                  {stats.hot_cold.cold.map((f) => (
                    <HotColdItem
                      key={`cold-${f.number}`}
                      number={f.number}
                      color={f.color}
                      count={f.count}
                    />
                  ))}
                </div>
              </div>

              <div className="card">
                <h2>Resumo</h2>
                <StatsPanel stats={stats} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detailed analytics below */}
      {stats && stats.total_spins > 0 && (
        <>
          <div className="card">
            <h2>Frequência por número</h2>
            <FrequencyChart frequencies={stats.frequencies} />
          </div>

          <div className="card">
            <h2>Heatmap da mesa</h2>
            <HeatMap frequencies={stats.frequencies} totalSpins={stats.total_spins} />
          </div>
        </>
      )}
    </div>
  );
}
