import './GameSettings.css';
import { useGameSettings } from '../context/gameSettingsContext';
import { THEMES } from '../game/themes';

export default function GameSettings() {
  const { theme, ballSpeedMultiplier, setTheme, setBallSpeedMultiplier } = useGameSettings();

  return (
    <div className="game-settings">
      <div>
        <p className="game-settings__section-title">Map theme</p>
        <div className="game-settings__themes">
          {Object.entries(THEMES).map(([key, entry]) => (
            <div key={key}>
              <button
                className={`game-settings__theme-btn${theme === key ? ' game-settings__theme-btn--active' : ''}`}
                onClick={() => setTheme(key)}
                title={entry.label}
                aria-pressed={theme === key}
              >
                {entry.thumbnail
                  ? <img src={entry.thumbnail} alt={entry.label} />
                  : <div className="game-settings__theme-classic">CLASSIC</div>
                }
              </button>
              <p className="game-settings__theme-label">{entry.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="game-settings__section-title">Ball speed</p>
        <div className="game-settings__speed-row">
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.25"
            value={ballSpeedMultiplier}
            onChange={(e) => setBallSpeedMultiplier(parseFloat(e.target.value))}
            aria-label="Ball speed multiplier"
          />
          <span className="game-settings__speed-value">{ballSpeedMultiplier}×</span>
        </div>
      </div>
    </div>
  );
}
