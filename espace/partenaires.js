/*
  FC Gouesnou - Espace club
  Fichier : espace/partenaires.js (dépôt GitHub fcgouesnou.github.io)
  Rôle : onglet « Partenaires » - liste des entreprises et fiche (coordonnées, contacts, contrats,
         échéances par saison, paiements, documents, historique des actions, mail).
         Lecture : CODIR et commission partenaires ; modification : commission et administrateurs
         (droits appliqués par la base, l'écran ne fait que les refléter).
  Version : 2.2 - 21/11/2026 - vocabulaire : « présidents, trésorier, secrétaire » au lieu de « bureau » dans les textes affichés
            2.1 - 21/11/2026 - dons réservés au bureau (présidents, trésorier, secrétaire, administrateur) :
            la commission dépose une « demande de don » (avis par e-mail au bureau), le bureau modifie,
            valide, envoie ou annule ; chaque reçu validé est annoncé par e-mail avec le PDF au trésorier,
            au secrétaire, aux présidents et à la commission
            2.0 - 21/11/2026 - identité légale des entreprises pour les reçus fiscaux (raison sociale, SIREN,
            forme juridique, siège), trouvée dans l'annuaire public des entreprises : bloc dans « Coordonnées »
            (« C'est elle », correction à la main), liste « Identités à vérifier » dans « Dons », don pré-rempli
            1.9 - 17/11/2026 - entreprises archivées (fermeture, départ du contact...) : bouton « Archiver » /
            « Désarchiver » sur la fiche, choix « Entreprises archivées » dans la liste ; hors listes,
            tableau de bord et relances, historique conservé
            1.8 - 17/11/2026 - rôle « secrétariat » : consultation des partenaires et accès complet aux dons
            1.7 - 17/11/2026 - envoi du reçu signé par e-mail au donateur (bouton « Envoyer par e-mail »,
            « Renvoyer » ensuite), adresse demandée si elle manque
            1.6 - 17/11/2026 - reçus fiscaux en PDF sur les modèles officiels (fonction Edge « recu-fiscal ») :
            aperçu « non valable » avant validation, reçu signé et conservé après validation ;
            signature + tampon enregistrés par un administrateur ; forme juridique de l'entreprise
            1.5 - 17/11/2026 - vue « Dons » : dons des entreprises et des particuliers (licenciés, familles),
            reçu fiscal préparé (Cerfa 16216 entreprise, 11580 particulier), validé avec un numéro d'ordre
            AAAA-NNN, registre par année et export ; dons des contrats « Don » repris (reçus antérieurs)
            1.4.1 - 13/11/2026 - balises des modèles toutes remplacées : {{Formule}}, {{Montant}}, {{DateFin}}
            (dernier contrat), {{Saison}}, {{Référent}} = personne connectée qui prépare le mail
            1.4 - 13/11/2026 - listes de travail actionnables (reprise des derniers écrans de l'ancien module) :
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
    S.lecture = r.some(x => ['admin', 'codir', 'partenaires', 'secretariat'].includes(x.role));
    S.peutModifier = r.some(x => ['admin', 'partenaires'].includes(x.role));
    S.peutCompta = S.peutModifier || r.some(x => x.role === 'finances');
    S.peutDons = S.peutCompta || r.some(x => x.role === 'secretariat');
    S.estAdmin = r.some(x => x.role === 'admin');
    S.clubId = (r[0] || {}).club_id || null;
    // Gestion des dons (validation, envoi, annulation) : bureau et administrateurs, décidé par la base
    S.gereDons = false;
    if (S.peutDons && S.clubId) { const { data: g } = await sb.rpc('dons_gestion', { c: S.clubId }); S.gereDons = !!g; }
    // Nom de la personne connectée, pour la balise {{Référent}} des modèles de mail
    try {
      const { data: u } = await sb.auth.getUser();
      const { data: moi } = await sb.from('personnes').select('prenom, nom').eq('user_id', u.user.id).limit(1);
      S.moi = moi && moi[0] ? [moi[0].prenom, moi[0].nom].filter(Boolean).join(' ') : '';
    } catch (e) { S.moi = ''; }
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
    S.tous = data || [];
    S.entreprises = S.tous.filter(e => !e.archive_le);
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
    [['tableau', 'Tableau de bord'], ['liste', 'Entreprises'], ...(S.peutDons ? [['dons', 'Dons']] : [])].forEach(([v, t]) => nav.append(el('button', {
      class: 'onglet' + (S.vue === v ? ' actif' : ''), onclick: () => { S.vue = v; dessiner(); } }, t)));
    zone.append(nav, corps);
    if (S.vue === 'tableau') dessinerTableau(corps); else if (S.vue === 'dons') dessinerDons(corps); else dessinerListe(corps);
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
    const statuts = ['actifs', 'tous', 'à vérifier', ...(S.listes['Statut partenaire'] || []), 'archivées'];
    const selStatut = el('select', { class: 'champ' }, statuts.map(s => el('option', { value: s, selected: s === S.statut },
      s === 'actifs' ? 'Partenaires actifs' : s === 'tous' ? 'Toutes les entreprises' : s === 'à vérifier' ? 'Avec des points à vérifier' : s === 'archivées' ? 'Entreprises archivées (' + (S.tous.length - S.entreprises.length) + ')' : s)));
    const liste = el('div', { class: 'p-liste' });
    const barre = el('div', { class: 'p-barre' }, recherche, selStatut,
      S.peutModifier ? el('button', { class: 'mini', onclick: () => nouvelleEntreprise() }, '+ Entreprise') : null);
    zone.append(barre, liste);

    function remplir() {
      const q = S.filtre.toLowerCase();
      const arch = S.statut === 'archivées';
      const l = (arch ? S.tous.filter(e => e.archive_le) : S.entreprises).filter(e =>
        (S.statut === 'tous' || arch || (S.statut === 'actifs' ? /actif/i.test(e.statut || '') : S.statut === 'à vérifier' ? Number(e.a_verifier) > 0 : e.statut === S.statut)) &&
        (!q || [e.nom, e.ville, e.secteur, e.ref, e.referent].some(x => (x || '').toLowerCase().includes(q))));
      liste.replaceChildren(...(l.length ? l.map(e => {
        const reste = Number(e.attendu || 0) - Number(e.recu || 0);
        return el('button', { class: 'p-ligne', onclick: () => ouvrirFiche(e.id) },
          el('div', { class: 'p-ligne-nom' }, e.nom, el('small', {}, [e.ville, e.secteur].filter(Boolean).join(' · '))),
          el('div', { class: 'p-ligne-info' },
            e.archive_le ? el('span', { class: 'pastille p-autre' }, 'Archivée' + (e.archive_motif ? ' - ' + e.archive_motif : ''))
              : el('span', { class: 'pastille ' + (/actif/i.test(e.statut || '') ? 'p-entrainement' : 'p-autre') }, e.statut || '-'),
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
    const nomDe = (id) => (S.tous.find(e => e.id === id) || {}).nom || '-';
    const statutDe = (id) => (S.tous.find(e => e.id === id) || {}).statut || '';
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
    const e = S.tous.find(z => z.id === entrepriseId) || {};
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
    const [{ data: e }, { data: cts }, { data: kts }] = await Promise.all([
      sb.from('part_entreprises').select('*').eq('id', entrepriseId).single(),
      sb.from('part_contacts').select('*').eq('entreprise_id', entrepriseId).order('principal', { ascending: false }),
      sb.from('part_contrats').select('formule, montant_annuel, date_fin, saison_debut').eq('entreprise_id', entrepriseId).order('saison_debut', { ascending: false }).limit(1)]);
    if (!e) { toast('Entreprise introuvable.'); return; }
    const contact = (cts || []).find(c => c.principal && c.email) || (cts || []).find(c => c.email) || (cts || [])[0] || null;
    if (!((contact && contact.email) || e.email)) { toast('Aucune adresse mail pour ' + e.nom + ' : complétez la fiche.'); ouvrirFiche(e.id); return; }
    ecrire(e, contact, { modele, actionId, retour: fermer, contrat: (kts || [])[0] || null });
  }

  // ---------- Contrôle compta : relier une écriture à une échéance ----------
  const sansAccent = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function devinerEntreprise(x) {
    if (x.entreprise_id) return x.entreprise_id;
    const lib = ' ' + sansAccent(x.libelle).replace(/[^a-z0-9]+/g, ' ') + ' ';
    // Noms utilisés par la banque ou la compta (repris de l'ancien rapprochement)
    const ALIAS = { salgo: 'U Express Gouesnou', kerbar: 'E.Leclerc Gouesnou', somega: 'Atymo', larvor: 'Meubles Gautier Brest', smpi: 'Meubles Gautier Brest' };
    for (const [m, nom] of Object.entries(ALIAS)) if (lib.includes(' ' + m + ' ')) { const e = S.tous.find(z => z.nom === nom); if (e) return e.id; }
    let best = null, score = 0;
    for (const e of S.tous) {
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
        e.archive_le ? el('p', { class: 'p-marque' }, 'Entreprise archivée le ' + dateFr(e.archive_le.slice(0, 10)) + (e.archive_motif ? ' - ' + e.archive_motif : '')) : null,
        el('div', { class: 'actions-coach' },
          principal || e.email ? el('button', { class: 'mini', onclick: () => ecrire(e, principal, { contrat: [...(contrats || [])].sort((x, y) => (y.saison_debut || '').localeCompare(x.saison_debut || ''))[0] || null }) }, 'Écrire un mail') : null,
          S.peutModifier ? el('button', { class: 'mini', onclick: () => e.archive_le ? desarchiver(e) : formArchiver(e) }, e.archive_le ? 'Désarchiver' : 'Archiver') : null,
          el('button', { class: 'mini', onclick: fermer }, 'Fermer')),
        onglets, corps);
      corps.append(sections[0][1]());
    });
  }
  // Archivage : l'entreprise sort des listes, du tableau de bord et des relances ; son historique est conservé
  function formArchiver(e) {
    fenetre('Archiver ' + e.nom, (f) => {
      const motif = el('select', { class: 'champ' }, ['Fermeture', 'Départ du contact (retraite)', 'Départ du contact', 'Ne souhaite plus être sollicitée', 'Autre']
        .map(m => el('option', { value: m }, m)));
      const precision = entree('', { placeholder: 'Précision (facultatif)' });
      f.append(el('p', { class: 'petit' }, 'L\'entreprise n\'apparaîtra plus dans les listes, le tableau de bord ni les relances. Ses contrats, paiements et échanges sont conservés ; elle reste visible avec le choix « Entreprises archivées » et peut être désarchivée.'),
        champ('Motif', motif), champ('Précision', precision),
        el('div', { class: 'boutons' }, el('button', { class: 'btn secondaire', onclick: () => ouvrirFiche(e.id) }, 'Annuler'),
          el('button', { class: 'btn principal', onclick: async () => {
            const m = motif.value + (precision.value.trim() ? ' - ' + precision.value.trim() : '');
            const { error } = await sb.from('part_entreprises').update({ archive_le: new Date().toISOString(), archive_motif: m }).eq('id', e.id);
            if (error) { toast('Erreur : ' + error.message); return; }
            toast(e.nom + ' archivée.'); fermer(); await chargerListe(); if (S.zone) dessiner();
          } }, 'Archiver')));
    });
  }
  async function desarchiver(e) {
    if (!confirm('Désarchiver ' + e.nom + ' ? Elle réapparaîtra dans les listes et les relances.')) return;
    const { error } = await sb.from('part_entreprises').update({ archive_le: null, archive_motif: null }).eq('id', e.id);
    if (error) { toast('Erreur : ' + error.message); return; }
    toast(e.nom + ' désarchivée.'); rafraichir(e.id);
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
    z.append(blocIdentite(e));
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
      const sel = el('select', { class: 'champ' }, el('option', { value: '' }, 'Mail libre'), S.modeles.filter(m => /^[A-Z ]+$/.test(m.code)).map(m => el('option', { value: m.code }, m.code + ' - ' + (m.usage || ''))));
      const objet = entree(''); const texte = zoneTexte('', 10);
      const k = opt.contrat || null;
      const remplacer = (t) => (t || '').replaceAll('{{Civilité}}', (contact && contact.civilite) || '').replaceAll('{{Nom}}', (contact && contact.nom) || '')
        .replaceAll('{{Prénom}}', (contact && contact.prenom) || '').replaceAll('{{Entreprise}}', e.nom || '')
        .replaceAll('{{Référent}}', S.moi || e.referent || '').replaceAll('{{Saison}}', S.saison || '')
        .replaceAll('{{Formule}}', (k && k.formule) || '').replaceAll('{{Montant}}', k && k.montant_annuel ? eur(k.montant_annuel) : '')
        .replaceAll('{{DateFin}}', k && k.date_fin ? dateFr(k.date_fin) : '')
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

  // ---------- Dons et reçus fiscaux ----------
  // Entreprise : Cerfa 16216*01 (mécénat) ; particulier : Cerfa 11580*05. Le numéro d'ordre (AAAA-NNN)
  // est attribué par la base à la validation ; un reçu validé ne se modifie plus (annulation motivée).
  const MOYENS = ['Chèque', 'Virement', 'Espèces', 'Carte', 'Prélèvement', 'Autre'];
  const NATURES = ['Numéraire', 'En nature', 'Titres', 'Autre'];
  const FORMES = ['Déclaration de don manuel', 'Acte sous seing privé', 'Acte authentique', 'Autre'];
  const STATUTS_DON = { 'à valider': 'Reçu à valider', 'validé': 'Reçu validé', 'envoyé': 'Reçu envoyé', 'annulé': 'Reçu annulé', 'antérieur': 'Reçu antérieur (hors application)' };
  S.anneeDons = S.anneeDons || String(new Date().getFullYear());

  async function dessinerDons(zone) {
    zone.replaceChildren(el('p', { class: 'petit' }, 'Chargement des dons...'));
    const [{ data, error }, { data: club }] = await Promise.all([
      sb.from('dons').select('*').order('date_don', { ascending: false }),
      sb.from('clubs').select('nom_officiel, siege_adresse, siege_cp, siege_ville, rna, siret, objet, recu_signataire, recu_qualite').limit(1)]);
    if (error) { zone.replaceChildren(el('p', { class: 'vide' }, 'Dons indisponibles : ' + error.message)); return; }
    S.club = (club || [])[0] || {};
    const tous = data || [];
    const annees = [...new Set([String(new Date().getFullYear()), ...tous.map(d => d.date_don.slice(0, 4))])].sort().reverse();
    const liste = tous.filter(d => d.date_don.startsWith(S.anneeDons));
    const total = liste.filter(d => d.recu_statut !== 'annulé').reduce((n, d) => n + Number(d.montant), 0);
    const selAnnee = el('select', { class: 'champ' }, annees.map(a => el('option', { value: a, selected: a === S.anneeDons }, 'Dons de ' + a)));
    selAnnee.onchange = () => { S.anneeDons = selAnnee.value; dessinerDons(zone); };
    zone.replaceChildren(
      el('div', { class: 'p-resume' },
        el('div', {}, el('strong', {}, String(liste.length)), el('span', {}, 'dons en ' + S.anneeDons)),
        el('div', {}, el('strong', {}, eur(total)), el('span', {}, 'montant des dons')),
        el('div', {}, el('strong', {}, String(liste.filter(d => d.recu_statut === 'à valider').length)), el('span', {}, 'reçus à valider')),
        el('div', {}, el('strong', {}, String(liste.filter(d => ['validé', 'envoyé'].includes(d.recu_statut)).length)), el('span', {}, 'reçus validés'))),
      el('p', { class: 'petit' }, 'Dons sans contrepartie des entreprises (Cerfa 16216) et des particuliers (Cerfa 11580). Un contrat avec panneau ou visibilité est du parrainage : facture, pas de reçu. Année civile = année fiscale du donateur.'),
      S.gereDons ? null : el('p', { class: 'petit' }, 'La commission dépose une demande de don ; les présidents, le trésorier et le secrétaire sont prévenus par e-mail et valident le reçu.'),
      el('div', { class: 'p-barre' }, selAnnee,
        el('button', { class: 'mini', onclick: () => formDon(null) }, S.gereDons ? '+ Don' : '+ Demande de don'),
        el('button', { class: 'mini', onclick: () => exporterRegistre(liste) }, 'Exporter le registre'),
        el('button', { class: 'mini', onclick: () => identitesAVerifier() }, 'Identités à vérifier'),
        S.estAdmin ? el('button', { class: 'mini', onclick: () => formSignature() }, 'Signature des reçus') : null));
    if (!liste.length) { zone.append(el('p', { class: 'vide' }, 'Aucun don enregistré en ' + S.anneeDons + '.')); return; }
    for (const statut of ['à valider', 'validé', 'envoyé', 'antérieur', 'annulé']) {
      const l = liste.filter(d => d.recu_statut === statut);
      if (!l.length) continue;
      zone.append(el('h4', { class: 'p-titre' }, STATUTS_DON[statut] + ' (' + l.length + ')'));
      for (const d of l) zone.append(ligneDon(d, zone));
    }
  }

  function ligneDon(d, zone) {
    const actions = el('span', { class: 'p-boutons' });
    if (d.recu_statut === 'à valider' && !S.gereDons) {
      actions.append(el('button', { class: 'mini', onclick: () => ouvrirRecu(d) }, 'Aperçu du reçu'),
        el('span', { class: 'petit' }, 'Validation par les présidents, le trésorier ou le secrétaire'));
    } else if (d.recu_statut === 'à valider') {
      actions.append(el('button', { class: 'mini', onclick: () => formDon(d) }, 'Modifier'),
        el('button', { class: 'mini', onclick: () => ouvrirRecu(d) }, 'Aperçu du reçu'),
        el('button', { class: 'mini principal', onclick: async (ev) => {
          if (!confirm('Valider le reçu de ' + d.donateur_nom + ' (' + eur(d.montant) + ') ? Un numéro d\'ordre lui sera attribué et il ne pourra plus être modifié.')) return;
          ev.currentTarget.disabled = true;
          const { data: num, error } = await sb.rpc('don_valider', { p_don: d.id });
          if (error) { toast('Erreur : ' + error.message); ev.currentTarget.disabled = false; return; }
          toast('Reçu n° ' + num + ' validé. Préparation du reçu signé et de l\'avis par e-mail...');
          // Avis au trésorier, au secrétaire, aux présidents et à la commission, avec le PDF signé
          const r = await appelRecu({ action: 'avis_recu', don: d.id });
          if (r.msg) toast('Reçu n° ' + num + ' validé, avis non envoyé : ' + r.msg);
          else if (r.data && r.data.envoye) toast('Reçu n° ' + num + ' validé et annoncé par e-mail (' + r.data.a.length + ' destinataires).');
          dessinerDons(zone);
        } }, 'Valider le reçu'),
        el('button', { class: 'mini danger', onclick: async () => {
          if (!confirm('Supprimer ce don ?')) return;
          const { error } = await sb.from('dons').delete().eq('id', d.id);
          if (error) { toast('Erreur : ' + error.message); return; }
          toast('Don supprimé.'); dessinerDons(zone);
        } }, 'Supprimer'));
    } else if (['validé', 'envoyé'].includes(d.recu_statut) && !S.gereDons) {
      actions.append(el('button', { class: 'mini', onclick: () => ouvrirRecu(d) }, 'Reçu PDF'));
    } else if (['validé', 'envoyé'].includes(d.recu_statut)) {
      actions.append(el('button', { class: 'mini', onclick: () => ouvrirRecu(d) }, 'Reçu PDF'),
        el('button', { class: 'mini' + (d.recu_statut === 'validé' ? ' principal' : ''), onclick: () => envoyerRecu(d, zone) },
          d.recu_statut === 'envoyé' ? 'Renvoyer' : 'Envoyer par e-mail'),
        el('button', { class: 'mini danger', onclick: async () => {
          const motif = prompt('Motif de l\'annulation du reçu n° ' + d.recu_numero + ' :');
          if (!motif) return;
          const { error } = await sb.rpc('don_annuler', { p_don: d.id, p_motif: motif });
          if (error) { toast('Erreur : ' + error.message); return; }
          toast('Reçu annulé.'); dessinerDons(zone);
        } }, 'Annuler le reçu'));
    }
    return el('div', { class: 'p-ligne' },
      el('div', { class: 'p-ligne-nom' }, d.donateur_nom,
        el('small', {}, [dateFr(d.date_don), d.donateur_type === 'entreprise' ? 'Entreprise' : 'Particulier', d.moyen, d.nature !== 'Numéraire' ? d.nature : null,
          d.recu_numero ? 'reçu n° ' + d.recu_numero : null,
          d.recu_envoye_le ? 'envoyé le ' + dateFr(d.recu_envoye_le.slice(0, 10)) : null].filter(Boolean).join(' · '))),
      el('div', { class: 'p-ligne-info' }, el('strong', {}, eur(d.montant)), actions));
  }

  // ---------- Identité légale (reçus fiscaux) ----------
  // Raison sociale, SIREN, forme juridique et siège, nécessaires au Cerfa 16216 ; trouvés dans l'annuaire
  // public des entreprises (table part_siren), choisis ou corrigés par la commission, le trésorier ou le secrétariat.
  const sirenLisible = (x) => String(x || '').replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');
  function ligneCandidat(e, c, apres) {
    return el('div', { class: 'p-paiement' },
      el('span', {}, el('strong', {}, c.nom), ' · ' + c.forme, el('br'),
        el('small', {}, [c.adresse, [c.cp, c.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ') + ' · SIREN ' + sirenLisible(c.siren))),
      S.peutDons ? el('button', { class: 'mini principal', onclick: async (ev) => {
        ev.currentTarget.disabled = true;
        const { error } = await sb.rpc('part_siren_appliquer', { p_entreprise: e.id, p_siren: c.siren });
        if (error) { toast('Erreur : ' + error.message); ev.currentTarget.disabled = false; return; }
        toast('Identité enregistrée pour ' + e.nom + '.'); apres();
      } }, 'C\'est elle') : null);
  }
  function blocIdentite(e) {
    const b = el('div', { class: 'p-contrat' }, el('strong', {}, 'Identité légale (reçus fiscaux)'));
    if (e.siren || e.raison_sociale) b.append(
      el('div', {}, [e.raison_sociale || e.nom, e.forme_juridique].filter(Boolean).join(' · ') + (e.siren ? ' · SIREN ' + sirenLisible(e.siren) : '')),
      el('div', { class: 'petit' }, 'Siège : ' + ([e.siege_adresse, [e.siege_cp, e.siege_ville].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'non renseigné')),
      e.identite_source ? el('div', { class: 'petit' }, 'Source : ' + e.identite_source + (e.identite_maj ? ', le ' + dateFr(e.identite_maj.slice(0, 10)) : '')) : null);
    else b.append(el('div', { class: 'petit' }, 'Non renseignée : nécessaire pour un reçu fiscal (don sans contrepartie).'));
    const zone = el('div', {});
    b.append(zone);
    if (S.peutDons) b.append(el('div', { class: 'p-boutons', style: 'margin-top:8px' },
      el('button', { class: 'mini', onclick: () => formIdentite(e) }, e.siren ? 'Corriger' : 'Saisir')));
    sb.from('part_siren').select('*').eq('entreprise_id', e.id).maybeSingle().then(({ data: s }) => {
      if (!s || !s.candidats || !s.candidats.length) return;
      const autres = s.candidats.filter(c => c.siren !== e.siren).slice(0, 5);
      if (!autres.length) return;
      const liste = autres.map(c => ligneCandidat(e, c, () => rafraichir(e.id)));
      if (e.siren) zone.append(el('details', { class: 'details-liste' }, el('summary', {}, 'Autres correspondances dans l\'annuaire (' + autres.length + ')'), ...liste));
      else zone.append(el('p', { class: 'petit', style: 'margin:8px 0 4px' }, 'Correspondances trouvées dans l\'annuaire des entreprises (INSEE) :'), ...liste);
    });
    return b;
  }
  function formIdentite(e) {
    fenetre('Identité légale - ' + e.nom, (f) => {
      const raison = entree(e.raison_sociale || e.nom), siren = entree(e.siren, { inputmode: 'numeric', placeholder: '9 chiffres' }), forme = entree(e.forme_juridique, { placeholder: 'SARL, SAS, EURL, Entrepreneur individuel...' });
      const adr = entree(e.siege_adresse || e.adresse), cp = entree(e.siege_cp || e.code_postal), ville = entree(e.siege_ville || e.ville);
      f.append(el('p', { class: 'petit' }, 'Telles qu\'elles figurent sur l\'avis de situation INSEE ou l\'extrait Kbis (annuaire-entreprises.data.gouv.fr).'),
        champ('Raison sociale', raison), el('div', { class: 'p-deux' }, champ('SIREN', siren), champ('Forme juridique', forme)),
        champ('Adresse du siège', adr), el('div', { class: 'p-deux' }, champ('Code postal', cp), champ('Ville', ville)),
        el('div', { class: 'boutons' }, el('button', { class: 'btn secondaire', onclick: () => ouvrirFiche(e.id) }, 'Annuler'),
          el('button', { class: 'btn principal', onclick: async () => {
            const { error } = await sb.rpc('part_identite_saisir', { p_entreprise: e.id, p_raison: raison.value, p_siren: siren.value, p_forme: forme.value,
              p_adresse: vide(adr.value) ? casseAdresse(adr.value) : null, p_cp: cp.value, p_ville: vide(ville.value) ? casseNom(ville.value) : null });
            if (error) { toast('Erreur : ' + error.message); return; }
            toast('Identité enregistrée.'); rafraichir(e.id);
          } }, 'Enregistrer')));
    });
  }
  // Liste des entreprises dont l'identité reste à choisir parmi plusieurs correspondances
  async function identitesAVerifier() {
    const { data, error } = await sb.from('part_siren').select('entreprise_id, statut, candidats').eq('statut', 'à vérifier');
    if (error) { toast('Erreur : ' + error.message); return; }
    const parId = new Map(S.tous.map(e => [e.id, e]));
    const lignes = (data || []).map(x => ({ ...x, e: parId.get(x.entreprise_id) })).filter(x => x.e && !x.e.archive_le)
      .sort((a, b) => (a.e.statut === 'Partenaire actif' ? 0 : 1) - (b.e.statut === 'Partenaire actif' ? 0 : 1) || a.e.nom.localeCompare(b.e.nom, 'fr'));
    fenetre('Identités à vérifier (' + lignes.length + ')', (f) => {
      f.append(el('p', { class: 'petit' }, 'Pour chaque entreprise, choisissez la bonne correspondance dans l\'annuaire des entreprises, ou « Aucune ». Les partenaires actifs sont en tête. L\'identité sert aux reçus fiscaux.'));
      if (!lignes.length) f.append(el('p', { class: 'vide' }, 'Rien à vérifier.'));
      for (const x of lignes) {
        const bloc = el('div', { class: 'p-contrat' },
          el('div', { class: 'p-contrat-tete' }, el('strong', {}, x.e.nom), el('span', { class: 'petit' }, [x.e.statut, x.e.ville].filter(Boolean).join(' · ')),
            el('button', { class: 'mini', onclick: async (ev) => {
              ev.currentTarget.disabled = true;
              const { error: e2 } = await sb.rpc('part_siren_ecarter', { p_entreprise: x.entreprise_id });
              if (e2) { toast('Erreur : ' + e2.message); return; }
              bloc.remove(); toast('Écartée : identité à saisir à la main si besoin.');
            } }, 'Aucune')),
          ...x.candidats.slice(0, 4).map(c => ligneCandidat(x.e, c, () => { bloc.remove(); chargerListe(); })));
        f.append(bloc);
      }
      f.append(el('div', { class: 'boutons' }, el('button', { class: 'btn secondaire', onclick: () => { fermer(); if (S.zone) dessiner(); } }, 'Fermer')));
    });
  }

  async function formDon(d) {
    const ent = !d || d.donateur_type === 'entreprise';
    fenetre(d ? 'Modifier le don' : (S.gereDons ? 'Nouveau don' : 'Demande de don (validée par les présidents, le trésorier ou le secrétaire)'), (f) => {
      const type = el('select', { class: 'champ' }, el('option', { value: 'entreprise', selected: ent }, 'Entreprise (Cerfa 16216)'),
        el('option', { value: 'particulier', selected: !ent }, 'Particulier : licencié, parent, autre (Cerfa 11580)'));
      const selEnt = el('select', { class: 'champ' }, el('option', { value: '' }, 'Entreprise du module Partenaires (facultatif)'),
        S.entreprises.map(e => el('option', { value: e.id, selected: d && d.entreprise_id === e.id }, e.nom)));
      const nom = entree(d && d.donateur_nom, { placeholder: 'Raison sociale, ou Nom Prénom' });
      const siren = entree(d && d.donateur_siren, { placeholder: 'SIREN (entreprise)' });
      const fj = entree(d && d.donateur_forme_juridique, { placeholder: 'SARL, SAS, EURL, SA...' });
      const adr = entree(d && d.donateur_adresse, { placeholder: 'Adresse' });
      const cp = entree(d && d.donateur_cp, { placeholder: 'Code postal' });
      const ville = entree(d && d.donateur_ville, { placeholder: 'Ville' });
      const mail = entree(d && d.donateur_email, { placeholder: 'E-mail (envoi du reçu)', type: 'email' });
      const montant = entree(d && d.montant, { placeholder: 'Montant en euros', inputmode: 'decimal' });
      const date = entree(d ? d.date_don : new Date().toISOString().slice(0, 10), { type: 'date' });
      const sel = (l, v) => el('select', { class: 'champ' }, l.map(x => el('option', { value: x, selected: x === v }, x)));
      const moyen = sel(MOYENS, d ? d.moyen : 'Chèque'), nature = sel(NATURES, d ? d.nature : 'Numéraire'), forme = sel(FORMES, d ? d.forme : 'Déclaration de don manuel');
      const desc = zoneTexte(d && d.description, 2); desc.placeholder = 'Don en nature : description et valeur retenue';
      const com = zoneTexte(d && d.commentaire, 2); com.placeholder = 'Commentaire interne';
      const zEnt = champ('Entreprise', selEnt), zSiren = champ('SIREN', siren), zFj = champ('Forme juridique', fj);
      const maj = () => { const e = type.value === 'entreprise'; zEnt.hidden = !e; zSiren.hidden = !e; zFj.hidden = !e; };
      type.onchange = maj; maj();
      selEnt.onchange = async () => {
        if (!selEnt.value) return;
        const { data: e } = await sb.from('part_entreprises').select('nom, raison_sociale, siren, forme_juridique, siege_adresse, siege_cp, siege_ville, adresse, code_postal, ville, email').eq('id', selEnt.value).single();
        if (!e) return;
        // Identité légale (siège) en priorité : c'est elle qui figure sur le reçu fiscal
        nom.value = e.raison_sociale || e.nom || ''; siren.value = e.siren || ''; fj.value = e.forme_juridique || '';
        adr.value = e.siege_adresse || e.adresse || ''; cp.value = e.siege_cp || e.code_postal || ''; ville.value = e.siege_ville || e.ville || '';
        if (!mail.value) mail.value = e.email || '';
        if (!e.siren) toast('Identité légale non renseignée pour cette entreprise : complétez SIREN et forme juridique.');
      };
      f.append(champ('Donateur', type), zEnt, champ('Nom', nom), el('div', { class: 'p-deux' }, zSiren, zFj), champ('Adresse', adr),
        el('div', { class: 'p-deux' }, champ('Code postal', cp), champ('Ville', ville)), champ('E-mail', mail),
        el('div', { class: 'p-deux' }, champ('Montant (€)', montant), champ('Date du don', date)),
        el('div', { class: 'p-deux' }, champ('Mode de paiement', moyen), champ('Nature', nature)), champ('Forme du don', forme),
        champ('Description (don en nature)', desc), champ('Commentaire', com),
        el('div', { class: 'boutons' }, el('button', { class: 'btn secondaire', onclick: fermer }, 'Annuler'),
          el('button', { class: 'btn principal', onclick: async () => {
            const m = nombre(montant.value);
            if (!vide(nom.value) || !m || m <= 0 || !date.value) { toast('Nom, montant et date sont nécessaires.'); return; }
            const e = type.value === 'entreprise';
            const ligne = { donateur_type: type.value, entreprise_id: e ? (selEnt.value || null) : null,
              donateur_nom: e ? vide(nom.value) : casseNom(nom.value), donateur_siren: e ? vide(siren.value.replace(/\s/g, '')) : null,
              donateur_forme_juridique: e ? vide(fj.value) : null,
              donateur_adresse: vide(adr.value) ? casseAdresse(adr.value) : null, donateur_cp: vide(cp.value), donateur_ville: vide(ville.value) ? casseNom(ville.value) : null,
              donateur_email: vide(mail.value), montant: m, date_don: date.value, moyen: moyen.value, nature: nature.value, forme: forme.value,
              description: vide(desc.value), commentaire: vide(com.value), modifie_le: new Date().toISOString() };
            const { data: cree, error } = d ? await sb.from('dons').update(ligne).eq('id', d.id).select('id').single()
                                : await sb.from('dons').insert({ ...ligne, club_id: S.clubId }).select('id').single();
            if (error) { toast('Erreur : ' + error.message); return; }
            fermer();
            if (!d && !S.gereDons && cree) {
              // Demande de la commission : avis par e-mail au bureau (trésorier, secrétaire, présidents)
              const r = await appelRecu({ action: 'avis_demande', don: cree.id });
              toast(r.msg ? 'Demande enregistrée, avis non envoyé : ' + r.msg : 'Demande enregistrée : les présidents, le trésorier et le secrétaire sont prévenus par e-mail.');
            } else toast(d ? 'Don modifié.' : 'Don enregistré : reçu à valider.');
            S.vue = 'dons'; S.anneeDons = date.value.slice(0, 4); dessiner();
          } }, 'Enregistrer')));
    });
  }

  // Appel de la fonction Edge « recu-fiscal » : { data, msg } (msg = message d'erreur lisible)
  async function appelRecu(body) {
    const { data, error } = await sb.functions.invoke('recu-fiscal', { body });
    let msg = data && data.erreur;
    if (error && !msg) { try { msg = (await error.context.json()).erreur; } catch (e) { msg = error.message; } }
    return { data, msg };
  }

  // Reçu en PDF sur le modèle officiel (fonction Edge « recu-fiscal ») : aperçu « non valable » tant
  // que le reçu n'est pas validé ; ensuite reçu signé, produit une seule fois et conservé.
  // La fenêtre est ouverte avant l'appel pour ne pas être bloquée par le navigateur.
  async function ouvrirRecu(d) {
    const w = window.open('', '_blank');
    if (w) w.document.write('<p style="font-family:sans-serif;padding:1em">Préparation du reçu...</p>');
    const { data, error } = await sb.functions.invoke('recu-fiscal', { body: { action: 'pdf', don: d.id } });
    let msg = data && data.erreur;
    if (error && !msg) { try { msg = (await error.context.json()).erreur; } catch (e) { msg = error.message; } }
    if (msg || !data || !data.url) { if (w) w.close(); toast('Reçu indisponible : ' + (msg || 'erreur inconnue')); return; }
    if (w) w.location.href = data.url; else location.href = data.url;
  }

  // Envoi du reçu signé par e-mail (depuis contact@), avec l'adresse du don ou celle saisie
  async function envoyerRecu(d, zone) {
    const saisie = prompt((d.recu_statut === 'envoyé' ? 'Renvoyer' : 'Envoyer') + ' le reçu n° ' + d.recu_numero + ' à l\'adresse :', d.donateur_email || '');
    if (saisie === null) return;
    const email = saisie.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Adresse e-mail invalide.'); return; }
    toast('Envoi en cours...');
    const { data, error } = await sb.functions.invoke('recu-fiscal', { body: { action: 'envoyer', don: d.id, email } });
    let msg = data && data.erreur;
    if (error && !msg) { try { msg = (await error.context.json()).erreur; } catch (e) { msg = error.message; } }
    if (msg) { toast('Envoi impossible : ' + msg); return; }
    toast('Reçu n° ' + d.recu_numero + ' envoyé à ' + data.email + '.'); dessinerDons(zone);
  }

  // Signature + tampon du signataire des reçus (image PNG, fond transparent de préférence) : administrateurs
  function formSignature() {
    const c = S.club || {};
    fenetre('Signature des reçus fiscaux', async (f) => {
      const zone = el('div', { class: 'p-signature' }, el('p', { class: 'petit' }, 'Chargement...'));
      const fichier = el('input', { type: 'file', accept: 'image/png', class: 'champ' });
      f.append(el('p', { class: 'petit' }, 'Signataire : ' + ([c.recu_signataire, c.recu_qualite].filter(Boolean).join(', ') || '-') +
          '. L\'image (signature et tampon du club, PNG) est conservée dans un dossier privé, lisible seulement par la fonction qui produit les reçus. ' +
          'À n\'enregistrer qu\'avec l\'accord du signataire.'),
        zone, champ('Nouvelle image (PNG)', fichier),
        el('div', { class: 'boutons' }, el('button', { class: 'btn secondaire', onclick: fermer }, 'Fermer'),
          el('button', { class: 'btn principal', onclick: async () => {
            const fi = fichier.files && fichier.files[0];
            if (!fi) { toast('Choisissez l\'image PNG.'); return; }
            if (fi.size > 2000000) { toast('Image trop lourde (2 Mo au plus).'); return; }
            const b64 = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = ko; r.readAsDataURL(fi); });
            const { data, error } = await sb.functions.invoke('recu-fiscal', { body: { action: 'signature', image: b64 } });
            let msg = data && data.erreur;
            if (error && !msg) { try { msg = (await error.context.json()).erreur; } catch (e) { msg = error.message; } }
            if (msg) { toast('Erreur : ' + msg); return; }
            fermer(); toast('Signature et tampon enregistrés.');
          } }, 'Enregistrer')));
      const { data } = await sb.functions.invoke('recu-fiscal', { body: { action: 'signature_voir' } });
      zone.replaceChildren(data && data.url
        ? el('img', { src: data.url, alt: 'Signature et tampon enregistrés', style: 'max-width:260px;background:#fff;border:1px solid #ddd;padding:6px' })
        : el('p', { class: 'vide' }, 'Aucune signature enregistrée : les reçus validés ne peuvent pas encore être produits.'));
    });
  }

  function exporterRegistre(liste) {
    const lignes = [['N° de reçu', 'Date du reçu', 'Statut', 'Type', 'Donateur', 'SIREN', 'Adresse', 'Code postal', 'Ville', 'Montant', 'Date du don', 'Mode', 'Nature', 'Commentaire']];
    for (const d of [...liste].sort((a, b) => (a.recu_numero || 'z').localeCompare(b.recu_numero || 'z') || a.date_don.localeCompare(b.date_don)))
      lignes.push([d.recu_numero || '', dateFr(d.recu_date), STATUTS_DON[d.recu_statut], d.donateur_type, d.donateur_nom, d.donateur_siren || '', d.donateur_adresse || '',
        d.donateur_cp || '', d.donateur_ville || '', String(d.montant).replace('.', ','), dateFr(d.date_don), d.moyen, d.nature, d.commentaire || '']);
    const csv = '\ufeff' + lignes.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    const a = el('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: 'Registre des dons ' + S.anneeDons + '.csv' });
    document.body.append(a); a.click(); a.remove();
  }

  return { initialiser, afficher };
}
