/*
  FC Gouesnou - Espace club
  Fichier : espace/partenaires.js (dépôt GitHub fcgouesnou.github.io)
  Rôle : onglet « Partenaires » - liste des entreprises et fiche (coordonnées, contacts, contrats,
         échéances par saison, paiements, documents, historique des actions, mail).
         Lecture : CODIR et commission partenaires ; modification : commission et administrateurs
         (droits appliqués par la base, l'écran ne fait que les refléter).
  Version : 1.4 - 13/11/2026 - listes de travail actionnables (reprise des derniers écrans de l'ancien module) :
            actions (Fait avec compte rendu, Mail, +7 j, Annuler), paiements attendus (rappel de paiement),
            à renouveler (mail de reconduction, appel, ne renouvelle pas), échéances (fins de contrat sous 120 j,
            anniversaires sous 60 j : mail, visite), sans suite (relance) ; mails pré-remplis depuis les listes
            1.3.1 - 13/11/2026 - casse : « France » retiré, petits mots en minuscules dans les noms composés
            1.3 - 13/11/2026 - rôle « finances » (comptable) : paiements, relier et écarter les écritures
            1.2 - 12/11/2026 - contrôle compta : boutons « Relier » (crée le paiement à partir de l'écriture)
            et « Écarter » (écriture qui n'est pas un partenariat)
            1.1 - 12/11/2026 - tableau de bord (indicateurs, évolution, paiements attendus, renouvellements,
            actions, fins de contrat, contrôle compta) ; documents du Drive visibles avec les contrats ;
            casse normalisée à l'enregistrement (adresse, ville, nom, prénom, fonction).
            1.0 - 12/11/2026 - première version (reprise du module Partenaires de l'Espace club Apps Script)
*/

// ---------- Casse (même règle que la base et l'import des terrains) ----------
const VOIES = new Set(['rue','avenue','av','boulevard','bd','place','route','impasse','allée','allee','chemin','quai','square','cours','voie','sentier','venelle','passage','rond-point','esplanade']);
const SIGLES = new Set(['ZA','ZI','ZAC','ZAE','ZAD','BP','CS','CEDEX','RN','RD','SAS','SARL','EURL','SA','SCI','SNC','EARL','TP','II','III','IV']);
const PETITS = new Set(['ar','an','ann','de','du','des','d','l','et','à','au','aux','sur','sous','en']);
const TRAIT = new Set(['de','du','des','la','le','les','sur','sous','en','ar','an','aux','au','lès']);
const maj1 = (x) => x.charAt(0).toUpperCase() + x.slice(1);
export function casseAdresse(a) {
  let s = String(a ?? '').replace(/\s+/g, ' ').trim().replace(/\u2019/g, "'");
  if (!s) return null;
  s = s.replace(/,\s*France\s*$/i, '');
  s = s.replace(/([cC])'([hH])/g, (_, c, h) => c + '\u02bc' + h.toLowerCase());
  s = s.replace(/\b([DdLl]) (?=[A-Za-zÀ-ÿ])/g, "$1'");
  s = s.replace(/\b[Rr][Tt][Ee]\b\.?/g, 'route');
  s = s.replace(/\b[Aa][Vv]\.(?=\s)/g, 'avenue');
  let debut = true, voie = false;
  s = s.split(/(\s+|')/).map((p) => {
    if (!p || /^\s+$/.test(p) || p === "'") return p;
    let w; const b = p.toLowerCase();
    if (SIGLES.has(p.toUpperCase())) w = p.toUpperCase();
    else if (/^\d/.test(p)) w = /^\d+(bis|ter|quater|[a-z])$/i.test(p) ? b : p;
    else if (VOIES.has(b) && !voie) w = b;
    else if (PETITS.has(b) && !debut) w = b;
    else w = b.split('-').map((x, i) => i > 0 && TRAIT.has(x) ? x : maj1(x)).join('-');
    if (VOIES.has(b) && !voie) voie = true;
    if (!/^\d/.test(p)) debut = false;
    return w;
  }).join('');
  s = s.replace(/(\d) (Bis|Ter)\b/g, (_, d, x) => d + ' ' + x.toLowerCase());
  s = s.replace(/\b(de|De) (Le|La|Les)\b/g, (_, d, x) => d + ' ' + x.toLowerCase());
  s = s.replace(/\b([dl])'([a-zà-ÿ])/g, (_, d, x) => d + "'" + x.toUpperCase());
  s = s.replace(/\u02bc/g, "'");
  return /^(rue|avenue|route|place|impasse|allée|chemin|boulevard|quai|square|venelle|passage)\b/.test(s) ? s : maj1(s);
}
// Nom, prénom, ville : « LE CORRE » -> « Le Corre », « jean-michel » -> « Jean-Michel » ; de, du, des, d' en minuscules au milieu
export function casseNom(t) {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim().replace(/\u2019/g, "'");
  if (!s) return null;
  let debut = true;
  return s.split(/(\s+|-|')/).map((p) => {
    if (!p || /^\s+$/.test(p) || p === '-' || p === "'") return p;
    const b = p.toLowerCase();
    const w = (!debut && ['de', 'du', 'des', 'd', 'ar', 'an', 'la', 'le', 'les', 'sur', 'en'].includes(b)) ? b : maj1(b);
    debut = false; return w;
  }).join('');
}
const casseDebut = (t) => { const s = String(t ?? '').trim(); return s ? maj1(s) : null; };

export function initPartenaires(ctx) {
  const { sb, el, toast } = ctx;
  const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const eur = (v) => v === null || v === undefined || v === '' ? '-' : euros.format(Number(v));
  const dateFr = (iso) => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
  const S = { peutModifier: false, clubId: null, saison: null, entreprises: [], listes: {}, modeles: [], filtre: '', statut: 'actifs', zone: null, vue: 'tableau', ouverts: new Set(['actions', 'paiements']) };

  // ---------- Fenêtre large ----------
  function fenetre(titre, remplir) {
    const v = document.getElementById('fenetre'); v.replaceChildren();
    const f = el('div', { class: 'fenetre large' }, el('h3', {}, titre));
    v.append(f); v.hidden = false;
    v.onclick = (e) => { if (e.target === v) fermer(); };
    remplir(f);
  }
  function fermer() { const v = document.getElementById('fenetre'); v.hidden = true; v.replaceChildren(); }
  const champ = (lib, input) => el('div', { class: 'p-champ' }, el('label', {}, lib), input);
  const entree = (val, attrs = {}) => { const i = el('input', { class: 'champ', ...attrs }); i.value = val ?? ''; return i; };
  const zoneTexte = (val, rows = 3) => { const t = el('textarea', { class: 'champ', rows }); t.value = val ?? ''; return t; };
  const choix = (liste, val, vide = true) => {
    const valeurs = [...new Set([...(S.listes[liste] || []), ...(val ? [val] : [])])];
    return el('select', { class: 'champ' }, vide ? el('option', { value: '' }, '-') : null,
      valeurs.map(v => el('option', { value: v, selected: v === val }, v)));
  };
  const vide = (v) => { const s = (v ?? '').toString().trim(); return s === '' ? null : s; };
  const nombre = (v) => { const s = (v ?? '').toString().replace(/\s/g, '').replace(',', '.'); return s === '' ? null : Number(s); };
  const marque = (texte) => texte ? el('span', { class: 'p-marque', title: texte }, 'À vérifier : ' + texte) : null;

  // ---------- Chargement ----------
  async function initialiser() {
    const { data: roles } = await sb.rpc('mes_roles');
    const r = roles || [];
    S.lecture = r.some(x => ['admin', 'codir', 'partenaires'].includes(x.role));
    S.peutModifier = r.some(x => ['admin', 'partenaires'].includes(x.role));
    S.peutCompta = S.peutModifier || r.some(x => x.role === 'finances');
    S.clubId = (r[0] || {}).club_id || null;
    return S.lecture;
  }
  async function chargerReferentiels() {
    const [{ data: l }, { data: m }, { data: p }] = await Promise.all([
      sb.from('part_listes').select('liste, valeur, ordre').order('ordre'),
      sb.from('part_modeles_mail').select('code, usage, objet, texte').order('code'),
      sb.from('part_parametres').select('saison_en_cours').limit(1)]);
    S.listes = {}; for (const x of l || []) (S.listes[x.liste] = S.listes[x.liste] || []).push(x.valeur);
    S.modeles = m || []; S.saison = (p && p[0] && p[0].saison_en_cours) || null;
  }
  async function chargerListe() {
    const { data, error } = await sb.from('part_vue_entreprises').select('*').order('nom');
    if (error) { toast('Erreur : ' + error.message); return; }
    S.entreprises = data || [];
  }

  // ---------- Liste ----------
  async function afficher(zone) {
    S.zone = zone;
    zone.replaceChildren(el('p', { class: 'petit' }, 'Chargement des partenaires...'));
    if (!Object.keys(S.listes).length) await chargerReferentiels();
    await chargerListe();
    dessiner();
  }
  // Deux vues : tableau de bord (par défaut) et liste des entreprises
  function dessiner() {
    const zone = S.zone; zone.replaceChildren();
    const nav = el('div', { class: 'p-onglets' });
    const corps = el('div', {});
    [['tableau', 'Tableau de bord'], ['liste', 'Entreprises']].forEach(([v, t]) => nav.append(el('button', {
      class: 'onglet' + (S.vue === v ? ' actif' : ''), onclick: () => { S.vue = v; dessiner(); } }, t)));
    zone.append(nav, corps);
    if (S.vue === 'tableau') dessinerTableau(corps); else dessinerListe(corps);
  }
  function dessinerListe(zone) {
    const actifs = S.entreprises.filter(e => /actif/i.test(e.statut || ''));
    const att = actifs.reduce((s, e) => s + Number(e.attendu || 0), 0) + S.entreprises.filter(e => !/actif/i.test(e.statut || '')).reduce((s, e) => s + Number(e.attendu || 0), 0);
    const rec = S.entreprises.reduce((s, e) => s + Number(e.recu || 0), 0);
    const nbVerif = S.entreprises.reduce((s, e) => s + Number(e.a_verifier || 0), 0);
    zone.append(el('div', { class: 'p-resume' },
      el('div', {}, el('strong', {}, String(actifs.length)), el('span', {}, 'partenaires actifs')),
      el('div', {}, el('strong', {}, eur(rec)), el('span', {}, 'reçus en ' + (S.saison || ''))),
      el('div', {}, el('strong', {}, eur(att)), el('span', {}, 'attendus en ' + (S.saison || ''))),
      el('div', {}, el('strong', {}, String(nbVerif)), el('span', {}, 'points à vérifier'))));

    const recherche = el('input', { class: 'champ', placeholder: 'Rechercher une entreprise, une ville, un secteur', value: S.filtre });
    const statuts = ['actifs', 'tous', 'à vérifier', ...(S.listes['Statut partenaire'] || [])];
    const selStatut = el('select', { class: 'champ' }, statuts.map(s => el('option', { value: s, selected: s === S.statut },
      s === 'actifs' ? 'Partenaires actifs' : s === 'tous' ? 'Toutes les entreprises' : s === 'à vérifier' ? 'Avec des points à vérifier' : s)));
    const liste = el('div', { class: 'p-liste' });
    const barre = el('div', { class: 'p-barre' }, recherche, selStatut,
      S.peutModifier ? el('button', { class: 'mini', onclick: () => nouvelleEntreprise() }, '+ Entreprise') : null);
    zone.append(barre, liste);

    function remplir() {
      const q = S.filtre.toLowerCase();
      const l = S.entreprises.filter(e =>
        (S.statut === 'tous' || (S.statut === 'actifs' ? /actif/i.test(e.statut || '') : S.statut === 'à vérifier' ? Number(e.a_verifier) > 0 : e.statut === S.statut)) &&
        (!q || [e.nom, e.ville, e.secteur, e.ref, e.referent].some(x => (x || '').toLowerCase().includes(q))));
      liste.replaceChildren(...(l.length ? l.map(e => {
        const reste = Number(e.attendu || 0) - Number(e.recu || 0);
        return el('button', { class: 'p-ligne', onclick: () => ouvrirFiche(e.id) },
          el('div', { class: 'p-ligne-nom' }, e.nom, el('small', {}, [e.ville, e.secteur].filter(Boolean).join(' · '))),
          el('div', { class: 'p-ligne-info' },
            el('span', { class: 'pastille ' + (/actif/i.test(e.statut || '') ? 'p-entrainement' : 'p-autre') }, e.statut || '-'),
            Number(e.attendu) ? el('span', { class: 'petit' }, eur(e.recu) + ' / ' + eur(e.attendu) + (reste > 0.009 ? ' - reste ' + eur(reste) : '')) : null,
            Number(e.a_verifier) ? el('span', { class: 'p-marque' }, e.a_verifier + ' à vérifier') : null,
            Number(e.actions_a_faire) ? el('span', { class: 'pastille p-match' }, e.actions_a_faire + ' action(s)') : null));
      }) : [el('p', { class: 'vide' }, 'Aucune entreprise ne correspond.')]));
    }
    recherche.addEventListener('input', () => { S.filtre = recherche.value; remplir(); });
    selStatut.addEventListener('change', () => { S.statut = selStatut.value; remplir(); });
    remplir();
  }

  // ---------- Tableau de bord ----------
  async function dessinerTableau(zone) {
    zone.replaceChildren(el('p', { class: 'petit' }, 'Calcul du tableau de bord...'));
    const [{ data: t, error }, { data: kts }, { data: acts }] = await Promise.all([
      sb.rpc('part_tableau_bord'),
      sb.from('part_contrats').select('id, ref, entreprise_id, formule, detail, montant_annuel, date_debut, date_fin, statut, reconduction_tacite'),
      sb.from('part_actions').select('entreprise_id, statut, date_prevue, date_realisee, type, objet')]);
    if (error || !t) { zone.replaceChildren(el('p', { class: 'vide' }, 'Tableau de bord indisponible : ' + (error ? error.message : 'aucune donnée'))); return; }
    const i = t.indicateurs;
    const taux = i.attendu ? Math.round(100 * i.recu / i.attendu) : 0;
    const ecart = i.recu_an_passe_meme_date ? Math.round(100 * (i.recu - i.recu_an_passe_meme_date) / i.recu_an_passe_meme_date) : null;
    const tuile = (valeur, libelle, detail, cible) => el(cible ? 'button' : 'div', { class: 'p-tuile' + (cible ? ' p-cliquable' : ''),
      onclick: cible ? () => document.getElementById('tb-' + cible)?.scrollIntoView({ behavior: 'smooth' }) : null },
      el('strong', {}, valeur), el('span', {}, libelle), detail ? el('small', {}, detail) : null);
    zone.replaceChildren();
    zone.append(el('p', { class: 'petit' }, 'Saison ' + t.saison + ' · situation au ' + new Date().toLocaleDateString('fr-FR')));
    zone.append(el('div', { class: 'p-tuiles' },
      el('div', { class: 'p-tuile p-tuile-large' },
        el('strong', {}, eur(i.recu)), el('span', {}, 'encaissés sur ' + eur(i.attendu) + ' attendus'),
        el('div', { class: 'p-jauge' }, el('div', { style: 'width:' + Math.min(100, taux) + '%' })),
        el('small', {}, taux + ' % · ' + i.entreprises_saison + ' entreprises' +
          (ecart !== null ? ' · ' + (ecart >= 0 ? '+' : '') + ecart + ' % par rapport à la même date en ' + t.saison_precedente + ' (' + eur(i.recu_an_passe_meme_date) + ')' : ''))),
      tuile(eur(Math.max(0, i.attendu - i.recu)), 'reste à encaisser', t.paiements_attendus.length + ' échéances', 'paiements'),
      tuile(String(i.a_renouveler), 'à renouveler', eur(i.a_renouveler_montant) + ' en ' + t.saison_precedente, 'renouvellements'),
      tuile(String(i.actions_a_faire), 'actions à faire', i.actions_en_retard ? i.actions_en_retard + ' en retard' : 'aucune en retard', 'actions'),
      tuile(String(i.actifs), 'partenaires actifs', null, null),
      tuile(String(i.a_verifier), 'points à vérifier', 'contrats, échéances, paiements', null),
      tuile(String(i.compta_sans_paiement), 'écritures compta', 'sans paiement relié', 'compta')));

    // Évolution par saison : barres attendu / encaissé
    const evo = t.evolution || [];
    const max = Math.max(1, ...evo.map(x => Math.max(Number(x.attendu), Number(x.recu))));
    zone.append(el('h4', { class: 'p-titre' }, 'Évolution par saison'),
      el('div', { class: 'p-evo' }, evo.map(x => el('div', { class: 'p-evo-col', title: x.saison + ' : ' + eur(x.recu) + ' encaissés sur ' + eur(x.attendu) + ' (' + x.entreprises + ' entreprises)' },
        el('div', { class: 'p-evo-barres' },
          el('div', { class: 'p-evo-att', style: 'height:' + (100 * x.attendu / max) + '%' }),
          el('div', { class: 'p-evo-rec', style: 'height:' + (100 * x.recu / max) + '%' })),
        el('small', {}, Math.round(x.recu / 100) / 10 + ' k€'),
        el('span', {}, x.saison.slice(2, 4) + '-' + x.saison.slice(7))))),
      el('p', { class: 'petit' }, el('span', { class: 'p-leg p-evo-att' }), ' attendu  ', el('span', { class: 'p-leg p-evo-rec' }), ' encaissé'));

    // Listes de travail
    const bloc = (id, titre, lignes, ouvert, rendu, ligne) => {
      const d = el('details', { class: 'details-liste p-bloc-tb', id: 'tb-' + id, open: S.ouverts.has(id) },
        el('summary', {}, titre + ' (' + lignes.length + ')'),
        lignes.length ? lignes.map(x => ligne ? ligne(x) : el('button', { class: 'p-ligne', onclick: () => x.entreprise_id && ouvrirFiche(x.entreprise_id) }, ...rendu(x)))
                      : [el('p', { class: 'vide' }, 'Rien à signaler.')]);
      d.addEventListener('toggle', () => { if (d.open) S.ouverts.add(id); else S.ouverts.delete(id); });
      return d;
    };
    const auj = new Date().toISOString().slice(0, 10);
    const retard = (d) => d && d < auj;
    const nomDe = (id) => (S.entreprises.find(e => e.id === id) || {}).nom || '-';
    const statutDe = (id) => (S.entreprises.find(e => e.id === id) || {}).statut || '';
    const jours = (iso) => Math.round((new Date(iso + 'T00:00:00') - new Date(auj + 'T00:00:00')) / 86400000);
    const peut = S.peutModifier;
    // Ligne de travail : le nom ouvre la fiche, les boutons agissent directement
    const ligneTravail = (entrepriseId, nom, sous, info, boutons) => el('div', { class: 'p-ligne' },
      el('button', { class: 'p-ligne-nom p-lien', onclick: () => entrepriseId && ouvrirFiche(entrepriseId) }, nom || '-', el('small', {}, sous || '')),
      el('span', { class: 'p-ligne-info' }, info, ...(peut ? boutons.filter(Boolean) : [])));
    const btn = (texte, action, principal) => el('button', { class: 'mini' + (principal ? ' principal' : ''), onclick: action }, texte);

    // Échéances : fins de contrat sous 120 jours, anniversaires (contrats pluriannuels) sous 60 jours
    const echeances = [];
    for (const k of kts || []) {
      if (!k.date_fin || k.statut === 'Échu') continue;
      const jf = jours(k.date_fin);
      if (jf >= 0 && jf <= 120) { echeances.push({ k, type: 'Fin de contrat', date: k.date_fin, j: jf }); continue; }
      if (k.date_debut && jf > 0) {
        const an = new Date(auj.slice(0, 4) + k.date_debut.slice(4) + 'T00:00:00');
        if (an.toISOString().slice(0, 10) < auj) an.setFullYear(an.getFullYear() + 1);
        const iso = an.toISOString().slice(0, 10), ja = jours(iso);
        if (iso < k.date_fin && ja <= 60) echeances.push({ k, type: 'Anniversaire', date: iso, j: ja });
      }
    }
    echeances.sort((a, b) => a.j - b.j);

    // Sans suite : statuts à suivre, dernier contact ancien, aucune action prévue
    const delai = Number(((S.listes['Relance sans réponse (jours)'] || [])[0])) || 15;
    const parEnt = {};
    for (const a of acts || []) {
      const x = parEnt[a.entreprise_id] = parEnt[a.entreprise_id] || { derniere: null, der: null, prevue: false };
      if (a.statut === 'À faire') x.prevue = true;
      const d = a.statut === 'Fait' ? (a.date_realisee || a.date_prevue) : null;
      if (d && (!x.derniere || d > x.derniere)) { x.derniere = d; x.der = a; }
    }
    const sansSuite = S.entreprises.filter(e => ['Prospect', 'À redémarcher', 'À confirmer', 'À renouveler'].includes(e.statut))
      .map(e => ({ e, x: parEnt[e.id] || {} })).filter(o => o.x.derniere && !o.x.prevue && -jours(o.x.derniere) >= delai)
      .sort((a, b) => a.x.derniere.localeCompare(b.x.derniere));

    zone.append(
      bloc('actions', 'Actions à faire', t.actions, true, null, (x) => ligneTravail(x.entreprise_id, x.nom,
        [x.type, x.objet, x.responsable].filter(Boolean).join(' · '),
        el('span', { class: 'pastille ' + (retard(x.date_prevue) ? 'p-annule' : 'p-autre') }, x.date_prevue ? dateFr(x.date_prevue) : 'sans date'),
        [btn('Fait', () => terminerAction(x), true),
         btn('Mail', () => ecrireA(x.entreprise_id, x.type === 'Relance' ? 'RELANCE' : 'PROSPECTION', x.id)),
         btn('+7 j', () => majAction(x.id, { date_prevue: isoDans(Math.max(7, (x.date_prevue ? jours(x.date_prevue) : 0) + 7)) }, 'Action reportée.')),
         btn('Annuler', () => { if (confirm('Annuler l\'action « ' + (x.objet || x.type || '') + ' » (' + (x.nom || '') + ') ?')) majAction(x.id, { statut: 'Annulé' }, 'Action annulée.'); })])),
      bloc('paiements', 'Paiements attendus en ' + t.saison, t.paiements_attendus, true, null, (x) => ligneTravail(x.entreprise_id, x.nom,
        [x.contrat, x.objet].filter(Boolean).join(' · '),
        el('span', { class: 'pastille ' + (Number(x.recu) > 0 ? 'p-match' : 'p-annule') }, eur(x.recu) + ' / ' + eur(x.attendu)),
        [btn('Rappel de paiement', () => ecrireA(x.entreprise_id, 'RAPPEL PAIEMENT'), true)])),
      bloc('renouvellements', 'À renouveler (partenaires ' + t.saison_precedente + ' sans contrat en ' + t.saison + ')', t.renouvellements, false, null, (x) => ligneTravail(x.entreprise_id, x.nom,
        [x.statut, x.prochaine_action ? 'action prévue le ' + dateFr(x.prochaine_action) : 'aucune action prévue'].filter(Boolean).join(' · '),
        el('span', { class: 'petit' }, eur(x.montant)),
        [btn('Mail de reconduction', () => ecrireA(x.entreprise_id, S.modeles.some(m => m.code === 'RECONDUCTION') ? 'RECONDUCTION' : 'RENOUVELLEMENT'), true),
         btn('Planifier un appel', () => planifier(x.entreprise_id, 'Appel', 7, 'Reconduction du partenariat pour la saison ' + t.saison)),
         btn('Ne renouvelle pas', () => { if (confirm(x.nom + ' passera au statut « Ancien partenaire ». Continuer ?')) changerStatut(x.entreprise_id, 'Ancien partenaire'); })])),
      bloc('echeances', 'Échéances (fins de contrat sous 120 jours, anniversaires sous 60 jours)', echeances, false, null, (o) => ligneTravail(o.k.entreprise_id, nomDe(o.k.entreprise_id),
        [o.type, o.k.ref, o.k.formule, o.k.reconduction_tacite ? 'reconduction tacite' : null].filter(Boolean).join(' · '),
        el('span', { class: 'petit' }, dateFr(o.date) + (o.k.montant_annuel ? ' · ' + eur(o.k.montant_annuel) : '')),
        [btn(o.type === 'Fin de contrat' ? 'Mail de renouvellement' : 'Mail', () => ecrireA(o.k.entreprise_id, o.type === 'Fin de contrat' ? 'RENOUVELLEMENT' : 'RAPPEL PAIEMENT'), true),
         btn('Planifier une visite', () => planifier(o.k.entreprise_id, 'Visite', 7, (o.type === 'Fin de contrat' ? 'Renouvellement du contrat ' : 'Anniversaire du contrat ') + o.k.ref + (o.k.formule ? ' (' + o.k.formule + ')' : '')))])),
      bloc('sanssuite', 'Sans suite (dernier contact il y a plus de ' + delai + ' jours, aucune action prévue)', sansSuite, false, null, (o) => ligneTravail(o.e.id, o.e.nom,
        [o.e.statut, o.x.der && [o.x.der.type, o.x.der.objet].filter(Boolean).join(' : ')].filter(Boolean).join(' · '),
        el('span', { class: 'petit' }, 'il y a ' + (-jours(o.x.derniere)) + ' j'),
        [btn('Mail de relance', () => ecrireA(o.e.id, 'RELANCE'), true),
         btn('Planifier une relance', () => planifier(o.e.id, 'Relance', 0, 'Relance suite au contact du ' + dateFr(o.x.derniere)))])),
      bloc('compta', 'Contrôle compta : écritures sans paiement relié', t.compta, false, null, (x) => el('div', { class: 'p-ligne' },
        el('div', { class: 'p-ligne-nom' }, x.nom || 'Entreprise non identifiée', el('small', {}, [dateFr(x.date), x.numero, x.libelle].filter(Boolean).join(' · '))),
        el('span', { class: 'p-ligne-info' }, el('strong', { class: 'petit' }, eur(x.montant)),
          S.peutCompta ? el('button', { class: 'mini', onclick: () => formRelier(x) }, 'Relier') : null,
          S.peutCompta ? el('button', { class: 'mini', onclick: () => ecarter(x) }, 'Écarter') : null))));
    if (S.retourBloc) { const b = document.getElementById('tb-' + S.retourBloc); S.retourBloc = null; b && b.scrollIntoView(); }
    if (S.ouverts.has('compta') && S.retourCompta) { S.retourCompta = false; document.getElementById('tb-compta')?.scrollIntoView(); }
  }

  // ---------- Actions depuis les listes de travail ----------
  const isoDans = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  function apresListe(bloc, message) { toast(message); fermer(); S.vue = 'tableau'; S.ouverts.add(bloc); S.retourBloc = bloc; chargerListe().then(dessiner); }
  async function majAction(id, champs, message) {
    const { error } = await sb.from('part_actions').update(champs).eq('id', id);
    if (error) { toast('Erreur : ' + error.message); return; }
    apresListe('actions', message);
  }
  function terminerAction(x) {
    fenetre('Action faite - ' + (x.nom || ''), (f) => {
      const cr = zoneTexte('', 4); const date = entree(new Date().toISOString().slice(0, 10), { type: 'date' });
      f.append(el('p', { class: 'petit' }, [x.type, x.objet].filter(Boolean).join(' : ')), champ('Fait le', date), champ('Compte rendu (facultatif)', cr),
        el('div', { class: 'boutons' }, el('button', { class: 'btn secondaire', onclick: fermer }, 'Annuler'),
          el('button', { class: 'btn principal', onclick: () => majAction(x.id, { statut: 'Fait', date_realisee: date.value || null, compte_rendu: vide(cr.value) }, 'Action notée comme faite.') }, 'Enregistrer')));
    });
  }
  async function planifier(entrepriseId, type, dans, objet) {
    const e = S.entreprises.find(z => z.id === entrepriseId) || {};
    const { error } = await sb.from('part_actions').insert({ club_id: S.clubId, entreprise_id: entrepriseId, type, statut: 'À faire',
      date_prevue: isoDans(dans), objet, responsable: e.referent || null });
    if (error) { toast('Erreur : ' + error.message); return; }
    apresListe('actions', type + ' prévu(e) le ' + dateFr(isoDans(dans)) + ' pour ' + (e.nom || 'l\'entreprise') + '.');
  }
  async function changerStatut(entrepriseId, statut) {
    const { error } = await sb.from('part_entreprises').update({ statut }).eq('id', entrepriseId);
    if (error) { toast('Erreur : ' + error.message); return; }
    apresListe('renouvellements', 'Statut mis à jour : ' + statut + '.');
  }
  // Mail pré-rempli depuis une liste : contact principal de l'entreprise, modèle choisi
  async function ecrireA(entrepriseId, modele, actionId) {
    const [{ data: e }, { data: cts }] = await Promise.all([
      sb.from('part_entreprises').select('*').eq('id', entrepriseId).single(),
      sb.from('part_contacts').select('*').eq('entreprise_id', entrepriseId).order('principal', { ascending: false })]);
    if (!e) { toast('Entreprise introuvable.'); return; }
    const contact = (cts || []).find(c => c.principal && c.email) || (cts || []).find(c => c.email) || (cts || [])[0] || null;
    if (!((contact && contact.email) || e.email)) { toast('Aucune adresse mail pour ' + e.nom + ' : complétez la fiche.'); ouvrirFiche(e.id); return; }
    ecrire(e, contact, { modele, actionId, retour: fermer });
  }

  // ---------- Contrôle compta : relier une écriture à une échéance ----------
  const sansAccent = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function devinerEntreprise(x) {
    if (x.entreprise_id) return x.entreprise_id;
    const lib = ' ' + sansAccent(x.libelle).replace(/[^a-z0-9]+/g, ' ') + ' ';
    // Noms utilisés par la banque ou la compta (repris de l'ancien rapprochement)
    const ALIAS = { salgo: 'U Express Gouesnou', kerbar: 'E.Leclerc Gouesnou', somega: 'Atymo', larvor: 'Meubles Gautier Brest', smpi: 'Meubles Gautier Brest' };
    for (const [m, nom] of Object.entries(ALIAS)) if (lib.includes(' ' + m + ' ')) { const e = S.entreprises.find(z => z.nom === nom); if (e) return e.id; }
    let best = null, score = 0;
    for (const e of S.entreprises) {
      const mots = sansAccent(e.nom).replace(/\(.*?\)/g, ' ').split(/[^a-z0-9]+/).filter(m => m.length >= 4 && !['sarl', 'gouesnou', 'brest', 'garage', 'ecole'].includes(m));
      const n = mots.filter(m => lib.includes(' ' + m + ' ')).length;
      if (n > score) { score = n; best = e.id; }
    }
    return best;
  }
  const saisonDe = (iso) => { const a = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)); return m >= 7 ? a + '-' + (a + 1) : (a - 1) + '-' + a; };
  function retourTableau() { fermer(); S.vue = 'tableau'; S.ouverts.add('compta'); S.retourCompta = true; chargerListe().then(dessiner); }

  function formRelier(x) {
    fenetre('Relier l\'écriture ' + x.numero, (f) => {
      const selE = el('select', { class: 'champ' }, el('option', { value: '' }, '- choisir l\'entreprise -'),
        [...S.entreprises].sort((a, b) => a.nom.localeCompare(b.nom)).map(e => el('option', { value: e.id }, e.nom)));
      selE.value = devinerEntreprise(x) || '';
      const zoneEch = el('div', {});
      const montant = entree(x.montant, { inputmode: 'decimal' });
      const date = entree(x.date, { type: 'date' });
      const moyenDevine = /\bCHQ\b|ch[eè]que/i.test(x.libelle || '') ? 'Chèque' : /\bVIRT?\b|virement/i.test(x.libelle || '') ? 'Virement' : null;
      const moyen = choix('Moyen de paiement', moyenDevine);
      const ecriture = entree(x.numero);
      const commentaire = zoneTexte('', 2);
      const enr = el('button', { class: 'btn principal' }, 'Créer le paiement');
      let selEch = null, contrats = [];
      async function chargerEcheances() {
        zoneEch.replaceChildren(); selEch = null; enr.disabled = true;
        if (!selE.value) return;
        const { data } = await sb.from('part_contrats').select('id, ref, formule, echeances:part_echeances(id, saison, objet, montant_attendu), paiements:part_paiements(echeance_id, montant)').eq('entreprise_id', selE.value);
        contrats = data || [];
        const ech = contrats.flatMap(c => (c.echeances || []).map(y => ({ ...y, contrat: c,
          recu: (c.paiements || []).filter(p => p.echeance_id === y.id).reduce((s, p) => s + Number(p.montant), 0) })))
          .sort((a, b) => a.saison.localeCompare(b.saison) || a.objet.localeCompare(b.objet));
        if (!ech.length) {
          zoneEch.append(el('p', { class: 'vide' }, 'Aucun contrat pour cette entreprise. Créez d\'abord le contrat dans sa fiche, puis revenez relier l\'écriture.'),
            el('button', { class: 'mini', onclick: () => ouvrirFiche(selE.value) }, 'Ouvrir la fiche'));
          return;
        }
        const s = saisonDe(x.date);
        const defaut = ech.find(y => y.saison === s && y.recu < Number(y.montant_attendu || 0)) || ech.find(y => y.saison === s)
          || ech.find(y => y.recu < Number(y.montant_attendu || 0)) || ech[ech.length - 1];
        selEch = el('select', { class: 'champ' }, ech.map(y => el('option', { value: y.id, selected: y === defaut },
          y.contrat.ref + ' · ' + y.saison + ' - ' + y.objet + ' (' + eur(y.recu) + ' / ' + eur(y.montant_attendu) + ')')));
        zoneEch.append(champ('Échéance réglée', selEch),
          el('p', { class: 'petit' }, 'Saison proposée d\'après la date (saison sportive juillet - juin) : ' + s + '. Pour une écriture qui règle deux échéances (contribution et fabrication du panneau), indiquez ici le premier montant, puis ajoutez le second paiement depuis la fiche avec le même numéro d\'écriture.'));
        enr.disabled = false;
      }
      selE.addEventListener('change', chargerEcheances);
      f.append(el('p', { class: 'petit' }, dateFr(x.date) + ' · ' + x.numero + ' · ' + (x.libelle || '') + ' · ' + eur(x.montant) + (x.compte ? ' · compte ' + x.compte : '')),
        champ('Entreprise', selE), zoneEch,
        el('div', { class: 'deux' }, champ('Montant (€)', montant), champ('Reçu le', date)),
        el('div', { class: 'deux' }, champ('Moyen', moyen), champ('Écriture comptable', ecriture)),
        champ('Commentaire', commentaire),
        el('div', { class: 'boutons' }, el('button', { class: 'btn secondaire', onclick: fermer }, 'Annuler'), enr));
      chargerEcheances();
      enr.addEventListener('click', async () => {
        const m = nombre(montant.value);
        if (!selEch || !m) { toast('Choisissez l\'échéance et indiquez le montant.'); return; }
        const y = contrats.flatMap(c => (c.echeances || []).map(e => ({ ...e, contrat_id: c.id }))).find(e => e.id === selEch.value);
        enr.disabled = true;
        const { error } = await sb.from('part_paiements').insert({ club_id: S.clubId, contrat_id: y.contrat_id, echeance_id: y.id, montant: m,
          date_reception: date.value || null, moyen: vide(moyen.value), ecriture: vide(ecriture.value), commentaire: vide(commentaire.value) });
        if (error) { enr.disabled = false; toast('Erreur : ' + error.message); return; }
        if (!x.entreprise_id) await sb.from('compta_ecritures').update({ entreprise_id: selE.value }).eq('id', x.id);
        toast('Paiement créé et relié à l\'écriture ' + x.numero + '.');
        retourTableau();
      });
    });
  }

  async function ecarter(x) {
    const motif = prompt('Écarter l\'écriture ' + x.numero + ' (' + eur(x.montant) + ') du contrôle compta.\nMotif (ex. don de particulier, pas un partenariat, doublon) :');
    if (!motif || !motif.trim()) return;
    const { data: u } = await sb.auth.getUser();
    const { error } = await sb.from('compta_ecritures').update({ ecartee: motif.trim(), ecartee_par: (u && u.user && u.user.email) || null }).eq('id', x.id);
    if (error) { toast('Erreur : ' + error.message); return; }
    toast('Écriture écartée.'); S.ouverts.add('compta'); S.retourCompta = true; dessiner();
  }

  async function nouvelleEntreprise() {
    const nom = prompt('Nom de la nouvelle entreprise :'); if (!nom || !nom.trim()) return;
    const { data: refs } = await sb.from('part_entreprises').select('ref').like('ref', 'P%');
    const n = Math.max(0, ...(refs || []).map(r => parseInt(r.ref.slice(1), 10) || 0)) + 1;
    const { data, error } = await sb.from('part_entreprises').insert({ club_id: S.clubId, ref: 'P' + String(n).padStart(3, '0'), nom: nom.trim(), statut: 'Prospect' }).select('id').single();
    if (error) { toast('Erreur : ' + error.message); return; }
    await chargerListe(); S.vue = 'liste'; dessiner(); ouvrirFiche(data.id);
  }

  // ---------- Fiche ----------
  async function ouvrirFiche(id) {
    fenetre('Chargement...', () => {});
    const [{ data: e }, { data: contacts }, { data: contrats }, { data: docs }, { data: actions }, { data: ecritures }] = await Promise.all([
      sb.from('part_entreprises').select('*').eq('id', id).single(),
      sb.from('part_contacts').select('*').eq('entreprise_id', id).order('principal', { ascending: false }),
      sb.from('part_contrats').select('*, echeances:part_echeances(*), paiements:part_paiements(*)').eq('entreprise_id', id).order('saison_debut', { ascending: false }),
      sb.from('part_documents').select('*').eq('entreprise_id', id).order('date_document', { ascending: false }),
      sb.from('part_actions').select('*').eq('entreprise_id', id).order('date_prevue', { ascending: false }),
      sb.from('compta_ecritures').select('numero, date_ecriture, commentaire, montant').eq('entreprise_id', id).order('date_ecriture', { ascending: false })]);
    if (!e) { fermer(); toast('Fiche introuvable.'); return; }
    fenetre(e.nom, (f) => {
      const onglets = el('div', { class: 'p-onglets' });
      const corps = el('div', {});
      const sections = [['Contrats et paiements', () => sectionContrats(e, contrats || [], ecritures || [], docs || [])],
                        ['Coordonnées', () => sectionCoordonnees(e, contacts || [])],
                        ['Historique', () => sectionHistorique(e, actions || [], contacts || [])],
                        ['Documents (' + (docs || []).length + ')', () => sectionDocuments(docs || [])]];
      sections.forEach(([t, fn], i) => onglets.append(el('button', { class: 'onglet' + (i === 0 ? ' actif' : ''), onclick: (ev) => {
        onglets.querySelectorAll('.onglet').forEach(b => b.classList.toggle('actif', b === ev.currentTarget));
        corps.replaceChildren(fn());
      } }, t)));
      const principal = (contacts || []).find(c => c.principal && c.email) || (contacts || []).find(c => c.email);
      f.append(el('p', { class: 'petit' }, [e.ref, e.statut, e.secteur, e.ville, e.referent ? 'référent ' + e.referent : null].filter(Boolean).join(' · ')),
        el('div', { class: 'actions-coach' },
          principal || e.email ? el('button', { class: 'mini', onclick: () => ecrire(e, principal) }, 'Écrire un mail') : null,
          el('button', { class: 'mini', onclick: fermer }, 'Fermer')),
        onglets, corps);
      corps.append(sections[0][1]());
    });
  }
  async function rafraichir(id) { await chargerListe(); if (S.zone) dessiner(); ouvrirFiche(id); }

  // Contrats, échéances et paiements
  const lienDrive = (d) => 'https://drive.google.com/file/d/' + d.drive_id + '/view';
  function sectionContrats(e, contrats, ecritures, docs) {
    const z = el('div', {});
    // Contrats, conventions et reçus signés : accès direct au Drive
    const signes = docs.filter(d => /contrat|convention|reçu|recu|attestation/i.test(d.type || ''));
    if (signes.length) z.append(el('div', { class: 'p-docs' }, el('span', { class: 'petit' }, 'Documents signés : '),
      signes.map(d => el('a', { class: 'mini', href: lienDrive(d), target: '_blank', rel: 'noopener', title: d.nom_fichier },
        (d.type || 'Document') + (d.date_document ? ' ' + dateFr(d.date_document) : '')))));
    if (S.peutModifier) z.append(el('button', { class: 'mini', onclick: () => formContrat(e, null) }, '+ Contrat'));
    if (!contrats.length) z.append(el('p', { class: 'vide' }, 'Aucun contrat.'));
    for (const c of contrats) {
      const ech = (c.echeances || []).sort((a, b) => a.saison.localeCompare(b.saison) || a.objet.localeCompare(b.objet));
      const bloc = el('div', { class: 'p-contrat' },
        el('div', { class: 'p-contrat-tete' },
          el('strong', {}, c.ref + ' - ' + (c.formule || 'sans formule')),
          el('span', { class: 'petit' }, [c.montant_annuel ? eur(c.montant_annuel) + ' par saison' : 'montant non renseigné',
            c.saison_debut + (c.duree_saisons > 1 ? ', ' + c.duree_saisons + ' saisons' : ''), c.statut, c.nature].filter(Boolean).join(' · ')),
          c.lien_document ? el('a', { class: 'mini', href: c.lien_document, target: '_blank', rel: 'noopener' }, 'Contrat') : null,
          S.peutModifier ? el('button', { class: 'mini', onclick: () => formContrat(e, c) }, 'Modifier') : null),
        c.detail ? el('p', { class: 'petit' }, c.detail) : null,
        marque(c.a_verifier),
        c.a_verifier && S.peutModifier ? el('button', { class: 'mini', onclick: () => verifie('part_contrats', c.id, e.id) }, 'Vérifié') : null);
      const table = el('div', { class: 'p-echeances' });
      for (const x of ech) {
        const pays = (c.paiements || []).filter(p => p.echeance_id === x.id).sort((a, b) => (a.date_reception || '').localeCompare(b.date_reception || ''));
        const recu = pays.reduce((s, p) => s + Number(p.montant), 0);
        const reste = Number(x.montant_attendu || 0) - recu;
        const etat = !x.montant_attendu ? 'p-autre' : reste <= 0.009 ? 'p-entrainement' : recu > 0 ? 'p-match' : 'p-annule';
        table.append(el('div', { class: 'p-echeance' },
          el('div', { class: 'p-echeance-tete' },
            el('span', {}, el('strong', {}, x.saison), ' - ' + x.objet),
            el('span', { class: 'pastille ' + etat }, eur(recu) + ' / ' + eur(x.montant_attendu)),
            S.peutCompta ? el('button', { class: 'mini', onclick: () => formPaiement(e, c, x, null) }, '+ Paiement') : null),
          marque(x.a_verifier),
          x.a_verifier && S.peutModifier ? el('button', { class: 'mini', onclick: () => verifie('part_echeances', x.id, e.id) }, 'Vérifié') : null,
          pays.map(p => el('div', { class: 'p-paiement' },
            el('span', {}, eur(p.montant) + ' le ' + dateFr(p.date_reception) + (p.moyen ? ' · ' + p.moyen : '') +
              (p.ecriture ? ' · ' + p.ecriture : '') + (p.exercice ? ' · exercice ' + p.exercice : '')),
            marque(p.a_verifier),
            S.peutCompta ? el('span', { class: 'p-boutons' },
              p.a_verifier ? el('button', { class: 'mini', onclick: () => verifie('part_paiements', p.id, e.id) }, 'Vérifié') : null,
              el('button', { class: 'mini', onclick: () => formPaiement(e, c, x, p) }, 'Modifier')) : null))));
      }
      bloc.append(table);
      z.append(bloc);
    }
    if (ecritures.length) z.append(el('details', { class: 'details-liste' }, el('summary', {}, 'Écritures comptables reliées (' + ecritures.length + ')'),
      ecritures.map(x => el('div', { class: 'ligne-joueur' }, el('span', {}, dateFr(x.date_ecriture) + ' · ' + x.numero + ' · ' + (x.commentaire || '')), el('span', {}, eur(x.montant))))));
    return z;
  }
  async function verifie(table, id, entrepriseId) {
    const { error } = await sb.from(table).update({ a_verifier: null }).eq('id', id);
    if (error) { toast('Erreur : ' + error.message); return; }
    toast('Point marqué comme vérifié.'); rafraichir(entrepriseId);
  }

  function formContrat(e, c) {
    fenetre(c ? 'Modifier le contrat ' + c.ref : 'Nouveau contrat - ' + e.nom, async (f) => {
      const saison = entree(c ? c.saison_debut : S.saison, { placeholder: 'AAAA-AAAA' });
      const formule = choix('Formule', c && c.formule);
      const nature = choix('Nature', c && c.nature);
      const montant = entree(c ? c.montant_annuel : '', { inputmode: 'decimal' });
      const duree = entree(c ? c.duree_saisons : 1, { type: 'number', min: 1, max: 10 });
      const signature = entree(c ? c.date_signature : '', { type: 'date' });
      const statut = entree(c ? c.statut : 'En cours');
      const detail = zoneTexte(c && c.detail, 2);
      const commentaire = zoneTexte(c && c.commentaire, 2);
      const lien = entree(c ? c.lien_document : '', { placeholder: 'Lien vers le contrat (Drive)' });
      const enr = el('button', { class: 'btn principal' }, 'Enregistrer');
      f.append(el('div', { class: 'deux' }, champ('Première saison', saison), champ('Durée (saisons)', duree)),
        el('div', { class: 'deux' }, champ('Formule', formule), champ('Nature', nature)),
        el('div', { class: 'deux' }, champ('Montant par saison (€)', montant), champ('Date de signature', signature)),
        champ('Statut', statut), champ('Détail (support, taille, emplacement, équipe)', detail), champ('Lien du document', lien),
        champ('Commentaire', commentaire),
        el('p', { class: 'petit' }, 'Une échéance « Contribution » est créée pour chaque saison couverte qui n\'en a pas encore.'),
        el('div', { class: 'boutons' }, el('button', { class: 'btn secondaire', onclick: () => ouvrirFiche(e.id) }, 'Retour'), enr));
      enr.addEventListener('click', async () => {
        const s = saison.value.trim();
        if (!/^\d{4}-\d{4}$/.test(s) || Number(s.slice(5)) !== Number(s.slice(0, 4)) + 1) { toast('Saison attendue sous la forme 2026-2027.'); return; }
        const d = Math.max(1, Math.min(10, parseInt(duree.value, 10) || 1));
        const a0 = Number(s.slice(0, 4));
        const ligne = { saison_debut: s, duree_saisons: d, formule: vide(formule.value), nature: vide(nature.value), montant_annuel: nombre(montant.value),
          date_signature: signature.value || null, statut: vide(statut.value), detail: vide(detail.value), commentaire: vide(commentaire.value),
          lien_document: vide(lien.value), date_debut: a0 + '-07-01', date_fin: (a0 + d) + '-06-30' };
        enr.disabled = true;
        let contratId = c && c.id;
        if (c) {
          const { error } = await sb.from('part_contrats').update(ligne).eq('id', c.id);
          if (error) { enr.disabled = false; toast('Erreur : ' + error.message); return; }
        } else {
          const { data: refs } = await sb.from('part_contrats').select('ref').like('ref', 'C%');
          const n = Math.max(0, ...(refs || []).map(r => parseInt(r.ref.slice(1), 10) || 0)) + 1;
          const { data, error } = await sb.from('part_contrats').insert({ ...ligne, club_id: S.clubId, entreprise_id: e.id, ref: 'C' + String(n).padStart(3, '0') }).select('id').single();
          if (error) { enr.disabled = false; toast('Erreur : ' + error.message); return; }
          contratId = data.id;
        }
        const saisons = Array.from({ length: d }, (_, k) => (a0 + k) + '-' + (a0 + k + 1));
        const { error: e2 } = await sb.from('part_echeances').upsert(saisons.map(x => ({ club_id: S.clubId, contrat_id: contratId, saison: x, objet: 'Contribution', montant_attendu: ligne.montant_annuel })),
          { onConflict: 'contrat_id,saison,objet', ignoreDuplicates: true });
        if (e2) toast('Contrat enregistré, mais échéances incomplètes : ' + e2.message); else toast('Contrat enregistré.');
        rafraichir(e.id);
      });
    });
  }

  function formPaiement(e, c, x, p) {
    fenetre(p ? 'Modifier le paiement' : 'Nouveau paiement - ' + c.ref + ' ' + x.saison, (f) => {
      const ech = (c.echeances || []).sort((a, b) => a.saison.localeCompare(b.saison));
      const selEch = el('select', { class: 'champ' }, ech.map(y => el('option', { value: y.id, selected: y.id === x.id }, y.saison + ' - ' + y.objet + ' (' + eur(y.montant_attendu) + ')')));
      const montant = entree(p ? p.montant : '', { inputmode: 'decimal' });
      const date = entree(p ? p.date_reception : new Date().toISOString().slice(0, 10), { type: 'date' });
      const moyen = choix('Moyen de paiement', p && p.moyen);
      const ecriture = entree(p ? p.ecriture : '', { placeholder: 'Ex. R161-2026/2027' });
      const recuPar = entree(p ? p.recu_par : '');
      const commentaire = zoneTexte(p && p.commentaire, 2);
      const enr = el('button', { class: 'btn principal' }, 'Enregistrer');
      f.append(champ('Saison réglée', selEch),
        el('div', { class: 'deux' }, champ('Montant (€)', montant), champ('Reçu le', date)),
        el('div', { class: 'deux' }, champ('Moyen', moyen), champ('Écriture comptable', ecriture)),
        champ('Reçu par', recuPar), champ('Commentaire', commentaire),
        el('p', { class: 'petit' }, 'L\'exercice comptable (1er juin - 31 mai) est calculé à partir de l\'écriture, ou à défaut de la date.'),
        el('div', { class: 'boutons' },
          p ? el('button', { class: 'btn secondaire', onclick: async () => {
            if (!confirm('Supprimer ce paiement ? Il restera visible dans le journal des modifications.')) return;
            const { error } = await sb.from('part_paiements').delete().eq('id', p.id);
            if (error) { toast('Erreur : ' + error.message); return; }
            toast('Paiement supprimé.'); rafraichir(e.id);
          } }, 'Supprimer') : null,
          el('button', { class: 'btn secondaire', onclick: () => ouvrirFiche(e.id) }, 'Retour'), enr));
      enr.addEventListener('click', async () => {
        const m = nombre(montant.value);
        if (!m) { toast('Indiquez le montant.'); return; }
        const ligne = { echeance_id: selEch.value, montant: m, date_reception: date.value || null, moyen: vide(moyen.value),
          ecriture: vide(ecriture.value), recu_par: vide(recuPar.value), commentaire: vide(commentaire.value) };
        enr.disabled = true;
        const { error } = p ? await sb.from('part_paiements').update(ligne).eq('id', p.id)
                            : await sb.from('part_paiements').insert({ ...ligne, club_id: S.clubId, contrat_id: c.id });
        if (error) { enr.disabled = false; toast('Erreur : ' + error.message); return; }
        toast('Paiement enregistré.'); rafraichir(e.id);
      });
    });
  }

  // Coordonnées et contacts
  function sectionCoordonnees(e, contacts) {
    const z = el('div', {});
    const ro = !S.peutModifier;
    const f = {
      nom: entree(e.nom), statut: choix('Statut partenaire', e.statut, false), secteur: choix('Secteur', e.secteur),
      referent: choix('Référents FCG', e.referent), adresse: entree(e.adresse), code_postal: entree(e.code_postal), ville: entree(e.ville),
      telephone: entree(e.telephone, { type: 'tel' }), email: entree(e.email, { type: 'email' }), site_web: entree(e.site_web), notes: zoneTexte(e.notes, 3)
    };
    if (ro) Object.values(f).forEach(i => i.disabled = true);
    z.append(champ('Entreprise', f.nom), el('div', { class: 'deux' }, champ('Statut', f.statut), champ('Référent FCG', f.referent)),
      champ('Secteur', f.secteur), champ('Adresse', f.adresse), el('div', { class: 'deux' }, champ('Code postal', f.code_postal), champ('Ville', f.ville)),
      el('div', { class: 'deux' }, champ('Téléphone', f.telephone), champ('E-mail', f.email)), champ('Site web', f.site_web), champ('Notes', f.notes));
    if (!ro) z.append(el('button', { class: 'btn principal', onclick: async (ev) => {
      const ligne = {}; for (const [k, i] of Object.entries(f)) ligne[k] = vide(i.value);
      if (!ligne.nom) { toast('Le nom est obligatoire.'); return; }
      ligne.adresse = casseAdresse(ligne.adresse); ligne.ville = casseNom(ligne.ville);
      ev.currentTarget.disabled = true;
      const { error } = await sb.from('part_entreprises').update(ligne).eq('id', e.id);
      if (error) { toast('Erreur : ' + error.message); ev.currentTarget.disabled = false; return; }
      toast('Coordonnées enregistrées.'); rafraichir(e.id);
    } }, 'Enregistrer les coordonnées'));

    z.append(el('h4', { class: 'p-titre' }, 'Contacts'), el('p', { class: 'petit' }, 'Le contact principal reçoit les mails.'));
    for (const c of contacts) z.append(ligneContact(e, c));
    if (!ro) z.append(el('button', { class: 'mini', onclick: () => formContact(e, null) }, '+ Contact'));
    return z;
  }
  function ligneContact(e, c) {
    return el('div', { class: 'p-paiement' },
      el('span', {}, [c.civilite, c.prenom, c.nom].filter(Boolean).join(' ') + (c.fonction ? ' (' + c.fonction + ')' : '') + (c.principal ? ' · principal' : ''),
        el('br'), el('small', {}, [c.email, c.telephone].filter(Boolean).join(' · ') || 'sans coordonnées')),
      S.peutModifier ? el('button', { class: 'mini', onclick: () => formContact(e, c) }, 'Modifier') : null);
  }
  function formContact(e, c) {
    fenetre(c ? 'Modifier le contact' : 'Nouveau contact - ' + e.nom, (f) => {
      const i = { civilite: entree(c && c.civilite, { placeholder: 'M., Mme' }), prenom: entree(c && c.prenom), nom: entree(c && c.nom), fonction: entree(c && c.fonction),
        email: entree(c && c.email, { type: 'email' }), telephone: entree(c && c.telephone, { type: 'tel' }), notes: zoneTexte(c && c.notes, 2) };
      const principal = el('input', { type: 'checkbox', checked: !!(c && c.principal) });
      const enr = el('button', { class: 'btn principal' }, 'Enregistrer');
      f.append(el('div', { class: 'deux' }, champ('Civilité', i.civilite), champ('Fonction', i.fonction)),
        el('div', { class: 'deux' }, champ('Prénom', i.prenom), champ('Nom', i.nom)),
        el('div', { class: 'deux' }, champ('E-mail', i.email), champ('Téléphone', i.telephone)), champ('Notes', i.notes),
        el('label', { class: 'p-case' }, principal, ' Contact principal'),
        el('div', { class: 'boutons' },
          c ? el('button', { class: 'btn secondaire', onclick: async () => {
            if (!confirm('Supprimer ce contact ?')) return;
            const { error } = await sb.from('part_contacts').delete().eq('id', c.id);
            if (error) { toast('Erreur : ' + error.message); return; }
            rafraichir(e.id);
          } }, 'Supprimer') : null,
          el('button', { class: 'btn secondaire', onclick: () => ouvrirFiche(e.id) }, 'Retour'), enr));
      enr.addEventListener('click', async () => {
        const ligne = {}; for (const [k, x] of Object.entries(i)) ligne[k] = vide(x.value);
        ligne.prenom = casseNom(ligne.prenom); ligne.nom = casseNom(ligne.nom); ligne.fonction = casseDebut(ligne.fonction);
        ligne.principal = principal.checked;
        if (!ligne.nom && !ligne.prenom) { toast('Indiquez au moins un nom.'); return; }
        if (ligne.principal) await sb.from('part_contacts').update({ principal: false }).eq('entreprise_id', e.id);
        const { error } = c ? await sb.from('part_contacts').update(ligne).eq('id', c.id)
                            : await sb.from('part_contacts').insert({ ...ligne, club_id: S.clubId, entreprise_id: e.id });
        if (error) { toast('Erreur : ' + error.message); return; }
        toast('Contact enregistré.'); rafraichir(e.id);
      });
    });
  }

  // Historique des actions
  function sectionHistorique(e, actions, contacts) {
    const z = el('div', {});
    if (S.peutModifier) z.append(el('button', { class: 'mini', onclick: () => formAction(e, null, contacts) }, '+ Action'));
    if (!actions.length) z.append(el('p', { class: 'vide' }, 'Aucune action enregistrée.'));
    for (const a of actions) z.append(el('div', { class: 'p-paiement' },
      el('span', {}, el('strong', {}, dateFr(a.date_realisee || a.date_prevue) + ' · ' + (a.type || 'Action') + ' · ' + a.statut),
        el('br'), (a.objet || '') + (a.responsable ? ' (' + a.responsable + ')' : ''),
        a.compte_rendu ? el('small', { class: 'p-bloc' }, a.compte_rendu) : null),
      S.peutModifier ? el('button', { class: 'mini', onclick: () => formAction(e, a, contacts) }, a.statut === 'À faire' ? 'Faire' : 'Modifier') : null));
    return z;
  }
  function formAction(e, a, contacts) {
    fenetre(a ? 'Action - ' + e.nom : 'Nouvelle action - ' + e.nom, (f) => {
      const type = choix("Type d'action", a && a.type);
      const statut = choix("Statut d'action", a ? (a.statut === 'À faire' ? 'Fait' : a.statut) : 'À faire', false);
      const prevue = entree(a ? a.date_prevue : new Date().toISOString().slice(0, 10), { type: 'date' });
      const realisee = entree(a ? (a.date_realisee || new Date().toISOString().slice(0, 10)) : '', { type: 'date' });
      const objet = entree(a && a.objet); const responsable = choix('Référents FCG', a ? a.responsable : e.referent);
      const contact = el('select', { class: 'champ' }, el('option', { value: '' }, '-'),
        contacts.map(c => { const n = [c.prenom, c.nom].filter(Boolean).join(' '); return el('option', { value: n, selected: a && a.contact === n }, n); }));
      const cr = zoneTexte(a && a.compte_rendu, 3);
      const enr = el('button', { class: 'btn principal' }, 'Enregistrer');
      f.append(el('div', { class: 'deux' }, champ('Type', type), champ('Statut', statut)),
        el('div', { class: 'deux' }, champ('Date prévue', prevue), champ('Date réalisée', realisee)),
        champ('Objet', objet), el('div', { class: 'deux' }, champ('Responsable', responsable), champ('Contact', contact)),
        champ('Compte rendu', cr),
        el('div', { class: 'boutons' }, el('button', { class: 'btn secondaire', onclick: () => ouvrirFiche(e.id) }, 'Retour'), enr));
      enr.addEventListener('click', async () => {
        const ligne = { type: vide(type.value), statut: statut.value || 'À faire', date_prevue: prevue.value || null,
          date_realisee: statut.value === 'Fait' ? (realisee.value || new Date().toISOString().slice(0, 10)) : (realisee.value || null),
          objet: vide(objet.value), responsable: vide(responsable.value), contact: vide(contact.value), compte_rendu: vide(cr.value) };
        const { error } = a ? await sb.from('part_actions').update(ligne).eq('id', a.id)
                            : await sb.from('part_actions').insert({ ...ligne, club_id: S.clubId, entreprise_id: e.id });
        if (error) { toast('Erreur : ' + error.message); return; }
        toast('Action enregistrée.'); rafraichir(e.id);
      });
    });
  }

  // Documents du Drive « Commission partenaires »
  function sectionDocuments(docs) {
    const z = el('div', {});
    if (!docs.length) { z.append(el('p', { class: 'vide' }, 'Aucun document rangé pour cette entreprise.')); return z; }
    for (const d of docs) z.append(el('div', { class: 'p-paiement' },
      el('span', {}, el('strong', {}, (d.type || 'Document') + (d.date_document ? ' du ' + dateFr(d.date_document) : '')),
        el('br'), el('small', {}, [d.nom_fichier, d.montant ? eur(d.montant) : null, d.remarque].filter(Boolean).join(' · '))),
      el('a', { class: 'mini', href: lienDrive(d), target: '_blank', rel: 'noopener' }, 'Ouvrir')));
    z.append(el('p', { class: 'petit' }, 'Les documents restent dans le Drive partagé « Commission partenaires » ; leur ouverture demande un compte du club ayant accès à ce Drive.'));
    return z;
  }

  // Mail : le modèle s'ouvre dans la messagerie de la personne connectée
  function ecrire(e, contact, opt = {}) {
    fenetre('Écrire à ' + e.nom, (f) => {
      const a = (contact && contact.email) || e.email;
      const sel = el('select', { class: 'champ' }, el('option', { value: '' }, 'Mail libre'), S.modeles.map(m => el('option', { value: m.code }, m.code + ' - ' + (m.usage || ''))));
      const objet = entree(''); const texte = zoneTexte('', 10);
      const remplacer = (t) => (t || '').replaceAll('{{Civilité}}', (contact && contact.civilite) || '').replaceAll('{{Nom}}', (contact && contact.nom) || '')
        .replaceAll('{{Prénom}}', (contact && contact.prenom) || '').replaceAll('{{Entreprise}}', e.nom || '').replaceAll('{{Référent}}', e.referent || '')
        .replace(/ {2,}/g, ' ');
      const appliquer = () => { const m = S.modeles.find(x => x.code === sel.value); objet.value = remplacer(m && m.objet); texte.value = remplacer(m && m.texte); };
      sel.addEventListener('change', appliquer);
      if (opt.modele && S.modeles.some(m => m.code === opt.modele)) { sel.value = opt.modele; appliquer(); }
      f.append(el('p', { class: 'petit' }, 'Destinataire : ' + a), champ('Modèle', sel), champ('Objet', objet), champ('Texte', texte),
        el('div', { class: 'boutons' }, el('button', { class: 'btn secondaire', onclick: () => opt.retour ? opt.retour() : ouvrirFiche(e.id) }, 'Retour'),
          el('button', { class: 'btn principal', onclick: async () => {
            location.href = 'mailto:' + encodeURIComponent(a) + '?subject=' + encodeURIComponent(objet.value) + '&body=' + encodeURIComponent(texte.value);
            if (S.peutModifier && sel.value) await sb.from('part_actions').insert({ club_id: S.clubId, entreprise_id: e.id, type: 'Mail', statut: 'Fait',
              date_prevue: new Date().toISOString().slice(0, 10), date_realisee: new Date().toISOString().slice(0, 10),
              objet: objet.value, modele_mail: sel.value, contact: contact ? [contact.prenom, contact.nom].filter(Boolean).join(' ') : null });
            // Mail préparé depuis une action à faire : l'action passe à « Fait »
            if (S.peutModifier && opt.actionId) await sb.from('part_actions').update({ statut: 'Fait', date_realisee: new Date().toISOString().slice(0, 10),
              compte_rendu: 'Mail envoyé : ' + objet.value }).eq('id', opt.actionId);
            if (opt.retour) apresListe(opt.actionId ? 'actions' : 'renouvellements', 'Mail ouvert dans votre messagerie et noté dans l\'historique.');
          } }, 'Ouvrir dans ma messagerie')));
    });
  }

  return { initialiser, afficher };
}
