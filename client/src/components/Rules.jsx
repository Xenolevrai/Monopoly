/**
 * Les règles, consultables à tout moment.
 *
 * Le texte n'est pas écrit à la main édition par édition : il est **déduit de la
 * configuration**. Une boîte qui n'a pas d'hypothèque ne verra pas le paragraphe
 * sur l'hypothèque, et une boîte à points de maison parlera de points. Ajouter
 * une édition, c'est donc aussi obtenir ses règles, sans rien rédiger.
 */
import { useState } from 'react';
import { editionFor, money, buildingLabels } from '../lib/board.js';

function Section({ title, children }) {
  return (
    <section className="space-y-1.5">
      <h3 className="font-condensed text-[12px] uppercase tracking-[0.2em] text-[var(--color-accent)]">
        {title}
      </h3>
      <div className="space-y-1 text-[13px] leading-relaxed">{children}</div>
    </section>
  );
}

function Line({ children }) {
  return <p>{children}</p>;
}

export function RulesContent({ state }) {
  const edition = editionFor(state);
  const m = edition.mechanics;
  const labels = buildingLabels(state);
  const isPoints = edition.currency.type === 'points';
  const unit = isPoints ? 'points de maison' : 'argent';
  const decks = Object.values(edition.theming.decks ?? {});

  return (
    <div className="space-y-5">
      <header>
        <p className="font-condensed text-xl uppercase tracking-[0.15em]">{edition.name}</p>
        <p className="text-[12px] text-ink-soft">{edition.theme}</p>
      </header>

      <Section title="Le but">
        <Line>
          {edition.winCondition === 'allLocationsExplored' ? (
            <>
              La partie s'arrête <strong>dès que le dernier lieu du plateau a été exploré</strong>.
              Chacune ajoute alors à sa réserve le droit de passage courant de chaque lieu qu'elle
              possède : le plus grand total l'emporte. Personne n'est éliminée en cours de route.
            </>
          ) : (
            <>
              Être la dernière encore solvable. Une joueuse qui ne peut plus payer fait faillite et
              quitte la partie ; celle qui reste gagne. On peut aussi arrêter d'un commun accord :
              le classement se fait alors au patrimoine.
            </>
          )}
        </Line>
      </Section>

      <Section title="Le tour de jeu">
        <Line>
          On lance {edition.dice.count} dés, on avance d'autant de cases, et on résout la case
          d'arrivée. Un double rejoue ; {edition.dice.doublesToJail} doubles d'affilée envoient
          directement en {edition.vocabulary?.jail?.toLowerCase() ?? 'prison'}.
        </Line>
        <Line>
          Repasser par la case Départ rapporte {money(state, edition.currency.goBonus)}. On commence
          la partie avec {money(state, edition.currency.startingAmount)}.
        </Line>
      </Section>

      <Section title={m.explorationMode ? 'Explorer un lieu' : 'Acheter une case'}>
        <Line>
          En arrivant sur une case libre, on peut {m.explorationMode ? "l'explorer" : "l'acheter"} au
          prix imprimé.
          {m.auctions && ' Si on refuse, elle part aux enchères et tout le monde peut miser.'}
        </Line>
        <Line>
          Une case occupée par une autre coûte un {edition.vocabulary?.rent?.toLowerCase() ?? 'loyer'}.
          Posséder <strong>tout un groupe de couleur</strong> double ce montant sur les cases nues.
        </Line>
        {/* Le privilège n'existe que si l'édition rattache un fief à un camp :
            le plateau de certaines boîtes n'a pas de salle commune. */}
        {edition.factions?.options.some((f) => f.homeSpace != null) && (
          <Line>
            La salle commune de <strong>votre propre maison</strong> est à part : vous l'explorez
            gratuitement en y arrivant, et vous n'y payez jamais rien, même si une autre l'a prise
            avant vous.
          </Line>
        )}
      </Section>

      {edition.factions && (
        <Section title={edition.factions.label}>
          <Line>
            Chacune choisit son camp au départ ({edition.factions.options.map((f) => f.label).join(', ')}).
            Il donne la couleur de vos {labels.houses.toLowerCase()} et l'identité de votre score.
          </Line>
        </Section>
      )}

      {m.houses && (
        <Section title={labels.houses}>
          <Line>
            Avec un groupe de couleur complet, on pose des {labels.houses.toLowerCase()} pour faire
            monter le montant dû. La construction se répartit également sur le groupe : pas de
            second {labels.house.toLowerCase()} quelque part tant que les autres n'en ont pas un.
          </Line>
          {m.hotels ? (
            <Line>
              Quatre {labels.houses.toLowerCase()} sur une case permettent d'y bâtir un{' '}
              {labels.hotel.toLowerCase()}.
            </Line>
          ) : (
            <Line>Il n'y a pas d'échelon au-dessus : quatre par case, c'est le maximum.</Line>
          )}
        </Section>
      )}

      {m.mortgage && (
        <Section title="Hypothèque">
          <Line>
            À court d'{unit}, on peut hypothéquer une case libre de constructions : la banque verse
            sa valeur hypothécaire, et la case ne rapporte plus rien tant qu'elle l'est. On la
            dégage plus tard en remboursant cette valeur majorée de{' '}
            {Math.round(edition.mortgage.interestRate * 100)} %.
          </Line>
          <Line className="text-ink-soft">
            Une case hypothéquée est signalée en pointillés dans la liste de vos biens, avec le
            bouton « Lever » et son coût affiché.
          </Line>
        </Section>
      )}

      <Section title={edition.vocabulary?.jail ?? 'La prison'}>
        <Line>
          On y va sur la case prévue, sur une carte, ou après{' '}
          {edition.dice.doublesToJail} doubles. Pour sortir : faire un double, payer{' '}
          {money(state, edition.jail.bail)}, ou utiliser une carte de sortie. Au bout de{' '}
          {edition.jail.maxTurns} tours, la sortie est payante d'office.
        </Line>
      </Section>

      <Section title={decks.length > 1 ? 'Les cartes' : `Les cartes ${decks[0]?.label ?? ''}`}>
        <Line>
          {decks.length > 1
            ? `Deux piles : ${decks.map((d) => d.label).join(' et ')}.`
            : `Une seule pile : ${decks[0]?.label}.`}{' '}
          On tire soi-même la carte du dessus du tas au centre du plateau, on la lit, puis on
          l'applique. Elle repart ensuite sous la pile.
        </Line>
      </Section>

      {m.trading && (
        <Section title="Négocier">
          <Line>
            À tout moment, on propose ce qu'on veut à qui on veut : des cases, de l'{unit}, des
            cartes de sortie. La réponse peut arriver <strong>sans attendre son tour</strong>.
          </Line>
          {m.negotiableRent && (
            <Line>
              Un montant dû ne se prélève jamais tout seul : on peut payer, proposer un arrangement
              à la créancière — qui efface la dette si elle accepte, quel qu'en soit le contenu — ou
              vendre quelque chose d'abord.
            </Line>
          )}
        </Section>
      )}

      <Section title={m.bankruptcyEliminates ? 'Ne plus pouvoir payer' : 'Être à court'}>
        {m.bankruptcyEliminates ? (
          <Line>
            Il faut réunir la somme : hypothéquer, revendre des constructions, négocier. Si vraiment
            rien n'est possible, on déclare faillite — les biens reviennent à la créancière, ou à la
            banque qui les remet aux enchères.
          </Line>
        ) : (
          <Line>
            Aucune élimination dans cette édition : on verse ce qu'on a, et l'affaire est close. On
            continue de jouer même à zéro point.
          </Line>
        )}
      </Section>

      <Section title="Sur plusieurs appareils">
        <Line>
          Plusieurs personnes peuvent jouer sur le même écran, et d'autres à distance avec le code
          de la partie. Tout est sauvegardé : on ferme, on revient le lendemain, et on reprend sa
          place depuis l'accueil — même si personne d'autre n'est connecté.
        </Line>
      </Section>
    </div>
  );
}

/** Le bouton « Règles » et sa fenêtre. */
export default function Rules({ state }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-black/15 bg-white px-2 py-1 font-condensed text-xs uppercase hover:bg-black/5"
      >
        Règles
      </button>

      {open && (
        <div
          className="fade-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="panel my-auto w-full max-w-2xl rounded-xl p-5 sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="font-condensed text-xl uppercase tracking-[0.2em]">Les règles</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded border border-black/15 bg-white px-2 py-1 text-ink-soft hover:text-ink"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            <RulesContent state={state} />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 w-full rounded bg-[var(--color-accent)] py-2.5 font-condensed text-sm uppercase text-white hover:bg-[var(--color-accent-deep)]"
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}
