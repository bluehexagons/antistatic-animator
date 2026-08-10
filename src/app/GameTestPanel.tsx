import React, { useState } from 'react';
import type {
  AgentPlayOptions,
  AgentPlayObservation,
  AgentPlayReady,
  AgentPlayRequest,
  AgentPlayResponse,
  AntistaticLaunchResult,
  AntistaticStartMode,
} from '../runtime/antistatic-types';

export interface GameTestPanelProps {
  rootDir: string;
  gamePath: string | null;
  ready: AgentPlayReady | null;
  response: AgentPlayResponse | null;
  busy: boolean;
  error: string | null;
  onLaunchGame: () => Promise<AntistaticLaunchResult | null>;
  onStopGame: () => Promise<void>;
  onStartAgentPlay: (options: Omit<AgentPlayOptions, 'rootDir'>) => Promise<void>;
  onRequest: (request: AgentPlayRequest) => Promise<void>;
  onStopAgentPlay: () => Promise<void>;
  onClose: () => void;
}

const startModes: AntistaticStartMode[] = ['press-start', 'main', 'versus', 'training', 'blank'];

const observationSummary = (observation: AgentPlayObservation | undefined) => {
  if (!observation) return null;
  return [
    ['scene', observation.scene ?? '-'],
    ['frame', observation.frame ?? '-'],
    ['scene frame', observation.sceneFrame ?? '-'],
    ['controllers', observation.controllers?.length ?? 0],
    ['players', observation.players?.length ?? 0],
    ['focus', observation.menu?.focusedId ?? '-'],
  ] as const;
};

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

export const GameTestPanel: React.FC<GameTestPanelProps> = ({
  rootDir,
  gamePath,
  ready,
  response,
  busy,
  error,
  onLaunchGame,
  onStopGame,
  onStartAgentPlay,
  onRequest,
  onStopAgentPlay,
  onClose,
}) => {
  const [startMode, setStartMode] = useState<AntistaticStartMode>('press-start');
  const [compile, setCompile] = useState(true);
  const [render, setRender] = useState(false);
  const [softwareGl, setSoftwareGl] = useState(false);
  const [resolution, setResolution] = useState('1280x720');
  const [debugSetup, setDebugSetup] = useState(false);
  const [debugStage, setDebugStage] = useState('Ruins');
  const [debugCharacter, setDebugCharacter] = useState('Silicon');
  const [customRequest, setCustomRequest] = useState('{"command":"observe"}');
  const [requestError, setRequestError] = useState<string | null>(null);
  const observation = response?.observation ?? ready?.observation;
  const summary = observationSummary(observation);
  const active = ready !== null;
  const screenshotsAvailable = ready?.capabilities?.screenshots === true;

  const request = (value: AgentPlayRequest) => {
    setRequestError(null);
    void onRequest(value);
  };

  const sendCustomRequest = () => {
    try {
      const value = JSON.parse(customRequest) as AgentPlayRequest;
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        typeof value.command !== 'string'
      ) {
        throw new Error('Enter an object with a string command field.');
      }
      request(value);
    } catch (requestParseError) {
      setRequestError((requestParseError as Error).message);
    }
  };

  const start = () => {
    void onStartAgentPlay({
      startMode: debugSetup ? 'training' : startMode,
      compile,
      render,
      softwareGl,
      resolution,
      headlessMenu: debugSetup ? 'training-menu' : undefined,
      stage: debugSetup ? debugStage : undefined,
      character: debugSetup ? debugCharacter : undefined,
    });
  };

  return (
    <div className="gamePanelOverlay" role="presentation" onClick={onClose}>
      <section
        className="gamePanel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-panel-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="gamePanelHeader">
          <div>
            <div className="gamePanelKicker">Antistatic / test console</div>
            <h1 id="game-panel-title">Game tools</h1>
          </div>
          <button
            className="iconBtn"
            onClick={onClose}
            title="Close game tools"
            aria-label="Close game tools"
          >
            x
          </button>
        </header>

        <div className="gamePanelBody">
          <div className="gamePanelPath" title={rootDir}>
            <span className="gamePanelDot" />
            <span>{rootDir || 'Open an Electron game directory first'}</span>
          </div>

          <section className="gamePanelSection">
            <div className="gamePanelSectionTitle">Windowed game</div>
            <p className="gamePanelHint">
              Launch the packaged build, or fall back to the repository's npm start script.
            </p>
            <div className="gamePanelActions">
              <button
                className="btn primary"
                disabled={!rootDir || busy}
                onClick={() => void onLaunchGame()}
              >
                Launch game
              </button>
              <button
                className="btn ghost"
                disabled={!gamePath || busy}
                onClick={() => void onStopGame()}
              >
                Stop game
              </button>
            </div>
            {gamePath && <div className="gamePanelStatus">Running: {gamePath}</div>}
          </section>

          <section className="gamePanelSection gamePanelHeadless">
            <div className="gamePanelSectionTitle">Headless test session</div>
            <p className="gamePanelHint">
              Uses Antistatic's deterministic agent-play protocol for frame stepping, scripted
              input, observations, and screenshots.
            </p>
            {!active ? (
              <>
                <div className="gamePanelForm">
                  <label>
                    Start mode
                    <select
                      value={startMode}
                      onChange={(e) => setStartMode(e.target.value as AntistaticStartMode)}
                      disabled={debugSetup}
                    >
                      {startModes.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </select>
                  </label>
                  {debugSetup && (
                    <>
                      <label>
                        Debug stage
                        <input value={debugStage} onChange={(e) => setDebugStage(e.target.value)} />
                      </label>
                      <label>
                        Character
                        <input
                          value={debugCharacter}
                          onChange={(e) => setDebugCharacter(e.target.value)}
                        />
                      </label>
                    </>
                  )}
                  <label>
                    Resolution
                    <input
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      disabled={!render && !softwareGl}
                    />
                  </label>
                </div>
                <div className="gamePanelChecks">
                  <label>
                    <input
                      type="checkbox"
                      checked={compile}
                      onChange={(e) => setCompile(e.target.checked)}
                    />{' '}
                    Compile TypeScript
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={render}
                      onChange={(e) => setRender(e.target.checked)}
                    />{' '}
                    Enable rendering
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={softwareGl}
                      onChange={(e) => setSoftwareGl(e.target.checked)}
                    />{' '}
                    Software GL
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={debugSetup}
                      onChange={(e) => setDebugSetup(e.target.checked)}
                    />{' '}
                    Debug setup
                  </label>
                </div>
                {debugSetup && (
                  <div className="gamePanelPresetNote">
                    Starts training on the requested stage, attaches the character to port 0, and
                    opens the debug menu so the scene is ready for inspection.
                  </div>
                )}
                <button className="btn primary" disabled={!rootDir || busy} onClick={start}>
                  Start headless session
                </button>
              </>
            ) : (
              <div className="gamePanelActions">
                <button
                  className="btn ghost"
                  disabled={busy}
                  onClick={() => request({ command: 'observe' })}
                >
                  Observe
                </button>
                <button
                  className="btn ghost"
                  disabled={busy}
                  onClick={() => request({ command: 'add-controller', port: 0 })}
                >
                  Add keyboard
                </button>
                <button
                  className="btn ghost"
                  disabled={busy}
                  onClick={() => request({ command: 'step', frames: 1 })}
                >
                  Step 1
                </button>
                <button
                  className="btn ghost"
                  disabled={busy}
                  onClick={() => request({ command: 'step', frames: 60 })}
                >
                  Step 60
                </button>
                {ready.startMode === 'training' && (
                  <>
                    <button
                      className="btn ghost"
                      disabled={busy}
                      onClick={() =>
                        request({ command: 'act', port: 0, frames: 2, input: { start: 1 } })
                      }
                      title="Toggle the training debug menu"
                    >
                      Toggle menu
                    </button>
                    <button
                      className="btn ghost"
                      disabled={busy}
                      onClick={() =>
                        request({ command: 'act', port: 0, frames: 2, input: { dright: 1 } })
                      }
                      title="Save the current training state"
                    >
                      Save state
                    </button>
                    <button
                      className="btn ghost"
                      disabled={busy}
                      onClick={() =>
                        request({ command: 'act', port: 0, frames: 2, input: { dleft: 1 } })
                      }
                      title="Load the saved training state"
                    >
                      Load state
                    </button>
                    <button
                      className="btn ghost"
                      disabled={busy}
                      onClick={() =>
                        request({
                          command: 'act',
                          port: 0,
                          frames: 2,
                          input: { shield1: 1, dright: 1 },
                        })
                      }
                      title="Freeze or unfreeze training"
                    >
                      Freeze
                    </button>
                    <button
                      className="btn ghost"
                      disabled={busy}
                      onClick={() =>
                        request({
                          command: 'act',
                          port: 0,
                          frames: 2,
                          input: { shield1: 1, ddown: 1 },
                        })
                      }
                      title="Advance one frozen training frame"
                    >
                      Frame +
                    </button>
                  </>
                )}
                <button
                  className="btn ghost"
                  disabled={busy || !screenshotsAvailable}
                  onClick={() => request({ command: 'screenshot', name: 'animator-frame' })}
                  title={
                    screenshotsAvailable
                      ? 'Capture the current rendered frame'
                      : 'Start with rendering enabled'
                  }
                >
                  Screenshot
                </button>
                <button className="btn" disabled={busy} onClick={() => void onStopAgentPlay()}>
                  Stop session
                </button>
              </div>
            )}
            {active && summary && (
              <div className="gameObservationGrid">
                {summary.map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{String(value)}</strong>
                  </div>
                ))}
              </div>
            )}
            {active && (
              <div className="gameQuickActions">
                <span>Quick input</span>
                <button
                  className="miniAction"
                  disabled={busy}
                  onClick={() => request({ command: 'act', port: 0, input: { attack: 1 } })}
                >
                  A
                </button>
                <button
                  className="miniAction"
                  disabled={busy}
                  onClick={() => request({ command: 'act', port: 0, input: { start: 1 } })}
                >
                  Start
                </button>
                <button
                  className="miniAction"
                  disabled={busy}
                  onClick={() => request({ command: 'act', port: 0, input: { hmove: -1 } })}
                >
                  Left
                </button>
                <button
                  className="miniAction"
                  disabled={busy}
                  onClick={() => request({ command: 'act', port: 0, input: { hmove: 1 } })}
                >
                  Right
                </button>
                <button
                  className="miniAction"
                  disabled={busy}
                  onClick={() => request({ command: 'act', port: 0, input: { shield1: 1 } })}
                >
                  Shield
                </button>
              </div>
            )}
            {active && (
              <div className="gameRequestBox">
                <label htmlFor="game-request">Protocol request</label>
                <textarea
                  id="game-request"
                  value={customRequest}
                  onChange={(e) => setCustomRequest(e.target.value)}
                  spellCheck={false}
                />
                <button className="btn ghost" disabled={busy} onClick={sendCustomRequest}>
                  Send JSON request
                </button>
              </div>
            )}
          </section>

          {(error || requestError) && <div className="gamePanelError">{error || requestError}</div>}
          {(response || ready) && (
            <pre className="gamePanelOutput">{pretty(response ?? ready)}</pre>
          )}
        </div>
      </section>
    </div>
  );
};
