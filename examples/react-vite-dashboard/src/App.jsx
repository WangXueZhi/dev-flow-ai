import {
  Activity,
  AlertTriangle,
  ChevronDown,
  CircleCheck,
  Clock3,
  Filter,
  Gauge,
  GitBranch,
  Radio,
  Search,
  Server,
  ShieldCheck,
  Zap
} from "lucide-react";
import { contracts, deployments, incidents, metrics, services } from "./data.js";

const metricIcons = [Gauge, ShieldCheck, Activity, AlertTriangle];

export function App() {
  return (
    <div className="app-shell">
      <aside className="rail" aria-label="Release navigation">
        <div className="brand-mark">OB</div>
        <nav className="rail-nav">
          <a className="rail-link active" href="#release" aria-label="Release">
            <GitBranch size={18} />
          </a>
          <a className="rail-link" href="#services" aria-label="Services">
            <Server size={18} />
          </a>
          <a className="rail-link" href="#incidents" aria-label="Incidents">
            <AlertTriangle size={18} />
          </a>
          <a className="rail-link" href="#contracts" aria-label="API contracts">
            <Radio size={18} />
          </a>
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Production window 23:00 UTC / visual ready</p>
            <h1>OpsBoard</h1>
          </div>
          <div className="command-row">
            <label className="search-field">
              <Search size={16} />
              <input aria-label="Search services" placeholder="Search service, owner, build" />
            </label>
            <button className="icon-button" type="button" title="Filter">
              <Filter size={17} />
            </button>
            <button className="deploy-button" type="button">
              <Zap size={17} />
              Deploy window
              <ChevronDown size={16} />
            </button>
          </div>
        </header>

        <section className="metric-grid" aria-label="Release metrics">
          {metrics.map((metric, index) => {
            const Icon = metricIcons[index];
            return (
              <article className={`metric-tile tone-${metric.tone}`} key={metric.label}>
                <div className="tile-head">
                  <Icon size={18} />
                  <span>{metric.label}</span>
                </div>
                <div className="metric-value">
                  {metric.value}
                  <small>{metric.suffix}</small>
                </div>
                <p>{metric.trend}</p>
              </article>
            );
          })}
        </section>

        <section className="work-grid">
          <article className="panel pipeline-panel" id="release">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Release train</p>
                <h2>Deployment pipeline</h2>
              </div>
              <span className="window-chip">Freeze in 38m</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Owner</th>
                    <th>Env</th>
                    <th>Status</th>
                    <th>Build</th>
                    <th>Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {deployments.map((item) => (
                    <tr key={item.service}>
                      <td>
                        <strong>{item.service}</strong>
                      </td>
                      <td>{item.owner}</td>
                      <td>{item.environment}</td>
                      <td>
                        <StatusPill status={item.status} />
                      </td>
                      <td className="mono">{item.build}</td>
                      <td>{item.nextAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="panel" id="incidents">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Live risk</p>
                <h2>Incident queue</h2>
              </div>
              <AlertTriangle size={20} />
            </div>
            <div className="incident-list">
              {incidents.map((incident) => (
                <div className="incident-row" key={`${incident.service}-${incident.age}`}>
                  <span className="severity">{incident.severity}</span>
                  <div>
                    <strong>{incident.service}</strong>
                    <p>{incident.detail}</p>
                  </div>
                  <span className="age">{incident.age}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel" id="services">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Service matrix</p>
                <h2>Health and latency</h2>
              </div>
              <Activity size={20} />
            </div>
            <div className="service-list">
              {services.map((service) => (
                <div className="service-row" key={service.name}>
                  <div className="service-name">
                    <span className={`dot tone-${service.tone}`} />
                    <strong>{service.name}</strong>
                  </div>
                  <div className="bar" aria-label={`${service.name} health ${service.health}`}>
                    <span style={{ width: `${service.health}%` }} />
                  </div>
                  <span className="mono">{service.latency}ms</span>
                  <span>{service.errors}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel" id="contracts">
            <div className="panel-head">
              <div>
                <p className="eyebrow">API readiness</p>
                <h2>Contract checks</h2>
              </div>
              <CircleCheck size={20} />
            </div>
            <div className="contract-list">
              {contracts.map((contract) => (
                <div className="contract-row" key={contract.endpoint}>
                  <span className="mono">{contract.endpoint}</span>
                  <StatusPill status={contract.schema} />
                  <span>{contract.owner}</span>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

function StatusPill({ status }) {
  const normalized = status.toLowerCase().replace(/\s+/g, "-");
  const icon = normalized === "healthy" || normalized === "stable" ? <CircleCheck size={14} /> : <Clock3 size={14} />;
  return <span className={`status-pill status-${normalized}`}>{icon}{status}</span>;
}
