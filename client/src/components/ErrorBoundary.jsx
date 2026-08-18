/**
 * Filet de sécurité : si un composant plante, on affiche l'erreur au lieu de
 * laisser une page blanche — et on propose de reprendre la partie, qui vit de
 * toute façon sur le serveur.
 */
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[monopoly] erreur d\'affichage :', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    // En mode « zone », on n'affiche qu'un encart : le reste de la page continue
    // de fonctionner, et la partie reste jouable.
    if (this.props.zone) {
      return (
        <div className="panel rounded-lg p-4 text-sm">
          <p className="font-condensed uppercase text-[var(--color-accent)]">
            {this.props.zone} n'a pas pu s'afficher
          </p>
          <p className="mt-1 text-xs text-ink-soft">{String(this.state.error?.message ?? this.state.error)}</p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="mt-2 rounded border border-black/15 bg-white px-3 py-1 font-condensed text-xs uppercase hover:bg-black/5"
          >
            Réessayer
          </button>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="panel w-full max-w-lg space-y-4 rounded-xl p-7">
          <h1 className="font-condensed text-2xl uppercase tracking-widest text-[var(--color-accent)]">
            Aïe, l'affichage a planté
          </h1>
          <p className="text-sm">
            La partie n'est pas perdue : elle vit sur le serveur. Rechargez la page, vous
            retrouverez tout au même point.
          </p>
          <pre className="scroll-thin max-h-40 overflow-auto rounded border border-black/15 bg-white p-2 text-[11px] text-ink-soft">
            {String(this.state.error?.stack || this.state.error)}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full rounded bg-[var(--color-accent)] py-2.5 font-condensed uppercase tracking-wide text-white hover:bg-[var(--color-accent-deep)]"
          >
            Recharger la partie
          </button>
        </div>
      </div>
    );
  }
}
