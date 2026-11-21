/*
  FC Gouesnou - Espace club
  Fichier : espace/aide.js (dépôt GitHub fcgouesnou.github.io)
  Rôle : aide de l'application (bouton « ? » de l'en-tête). Rubriques choisies selon le profil connecté
         (famille, joueur, coach ou dirigeant, CODIR, commission partenaires, trésorier, secrétariat,
         bureau, administrateur) ; la rubrique de l'onglet affiché est ouverte d'office.
         Onglet « RACI du bureau » : matrice des responsabilités lue dans la base (tables raci et
         raci_fonctions), réservée au bureau ; chaque ligne peut être ouverte plus tard au CODIR.
         Pendant un « Voir en tant que », l'aide suit le profil de la personne observée.
  Version : 1.4 - 21/11/2026 - rubrique « Direct du match et statistiques »
            1.3 - 21/11/2026 - rubriques « Voir en tant que » (présidents) et onglet Administration
            1.2 - 21/11/2026 - vocabulaire : « présidents, trésorier, secrétaire » au lieu de « bureau », onglet « RACI »
            1.1 - 21/11/2026 - prise en main : glisser vers le bas, bouton « Mettre à jour »
            1.0 - 21/11/2026 - première version
*/
export function initAide({ sb, el, ouvrirFenetre, fermerFenetre, toast, contexte }) {

  // ---------- Profil ----------
  async function profil() {
    const { data } = await sb.rpc('mes_roles');
    const roles = new Set((data || []).map(r => r.role));
    const cx = contexte();
    return {
      roles, clubId: ((data || [])[0] || {}).club_id || null,
      admin: roles.has('admin'), codir: roles.has('codir'),
      bureau: roles.has('admin') || roles.has('bureau'),
      commission: roles.has('partenaires'), finances: roles.has('finances'), secretariat: roles.has('secretariat'),
      partenaires: ['admin', 'codir', 'partenaires', 'finances', 'secretariat'].some(r => roles.has(r)),
      attestations: ['admin', 'finances', 'secretariat'].some(r => roles.has(r)),
      coach: cx.coach, famille: cx.famille, joueur: cx.joueur, vue: cx.vue, apercu: cx.apercu,
    };
  }

  // ---------- Rubriques ----------
  // pour(p) : la rubrique est montrée si vrai ; vues : onglets pour lesquels elle s'ouvre d'office
  const P = (...l) => el('p', {}, ...l);
  const L = (...items) => el('ul', {}, items.map(x => el('li', {}, x)));
  const B = (t) => el('strong', {}, t);
  const RUBRIQUES = [
    { id: 'debut', titre: 'Prise en main', pour: () => true, contenu: () => [
      P('L\'Espace club est l\'application du FC Gouesnou. Elle s\'ouvre à l\'adresse fcgouesnou.github.io/espace, avec votre compte Google du club ou un code reçu par e-mail.'),
      L([B('Installer'), ' : sur iPhone, Safari > Partager > « Sur l\'écran d\'accueil » ; sur Android, bouton « Installer l\'application ».'],
        [B('Notifications'), ' : bouton « Activer » du bandeau. Sur iPhone, l\'application doit être installée. Sans notification, un e-mail vous prévient.'],
        [B('Actualiser'), ' (ou glisser l\'écran vers le bas depuis le haut de la page) recharge les données et l\'onglet affiché. Quand une nouvelle version est publiée, le bouton devient « Mettre à jour », en jaune : touchez-le pour l\'installer.'],
        [B('Sortir'), ' vous déconnecte de cet appareil.'],
        'Aucune notification entre 21 h et 8 h, sauf une annulation du jour même.'),
    ] },
    { id: 'convocations', titre: 'Répondre aux convocations', vues: ['avenir'], pour: (p) => p.famille || p.joueur || p.coach, contenu: (p) => [
      P('L\'onglet « À venir » montre les événements de vos équipes et de vos enfants. Répondez en un geste : ', B('Présent'), ', ', B('Absent'), ' ou ', B('Incertain'), '.'),
      L('Date limite : 48 h avant un match, 24 h avant un entraînement. Les retardataires sont relancés.',
        'Le motif d\'absence est facultatif et n\'est vu que par les coachs.',
        'Les prénoms et réponses des autres convoqués sont visibles, jamais leurs motifs.',
        'Un désistement après « Présent » prévient le coach : changez votre réponse dès que possible.',
        'Un joueur répond lui-même à partir de 16 ans ; ses parents gardent la main.'),
      p.famille ? P('Pendant le pilote, les réponses aux convocations se font uniquement ici, plus dans SportEasy.') : null,
    ] },
    { id: 'covoiturage', titre: 'Covoiturage', vues: ['avenir'], pour: (p) => p.famille || p.coach, contenu: () => [
      P('Pour les matchs et tournois à venir, à domicile comme à l\'extérieur (pas les entraînements).'),
      L([B('Je propose des places'), ' : nombre de places libres pour d\'autres joueurs, sans compter votre enfant, lieu et heure de départ.'],
        [B('Je cherche une place'), ' : la demande disparaît dès qu\'une place est réservée.'],
        [B('Réserver pour…'), ' et ', B('Libérer'), ' ; le conducteur est prévenu.'],
        'Le coach peut vous désigner comme conducteur : vous êtes notifié et pouvez refuser.',
        'Les téléphones ne sont visibles qu\'entre le conducteur, les familles de ses passagers et les coachs.'),
    ] },
    { id: 'taches', titre: 'Tâches du match', vues: ['avenir'], pour: (p) => p.famille || p.joueur || p.coach, contenu: () => [
      P('Sur chaque carte de match, la ligne « Tâches » montre qui s\'occupe de quoi : lavage des maillots, ballons, chasubles, gourdes, pharmacie...'),
      L([B('Je prends'), ' pour vous engager, ', B('Je ne peux plus'), ' pour libérer la tâche.'],
        'Le lavage des maillots est ouvert aux parents, en rotation.',
        'Le nettoyage du vestiaire n\'est jamais confié aux parents : les coachs jusqu\'aux U13, les joueurs à partir des U14.'),
    ] },
    { id: 'direct', titre: 'Direct du match et statistiques', vues: ['avenir'], pour: (p) => p.famille || p.joueur || p.coach, contenu: (p) => [
      P('Sur la carte d\'un match, « Suivre le direct » affiche le score et le fil du match : buts (buteur, passeur, minute), remplacements, cartons. L\'écran se met à jour tout seul toutes les 30 secondes.'),
      p.coach ? L([B('Saisie'), ' : un bouton par action (But, But adverse, Remplacement, Carton, Note) ; la minute est proposée d\'après l\'heure du coup d\'envoi, modifiable. Une erreur se supprime avec la croix.'],
          [B('Composition de départ'), ' : touchez les titulaires ; le temps de jeu de chacun en dépend.'],
          [B('Délégué du match'), ' : confiez la saisie à un parent ou un dirigeant présent ; il est prévenu par notification.'],
          [B('Statistiques'), ' (onglet Mes équipes ou depuis le direct) : bilan, buteurs, passeurs, temps de jeu, cartons, présence aux entraînements, matchs de la saison.'])
        : P('« Statistiques » montre les chiffres de votre enfant (ou les vôtres) : matchs joués, temps de jeu, buts, passes, présence aux entraînements. Ceux de toute l\'équipe sont réservés aux coachs.'),
    ] },
    { id: 'equipes', titre: 'Mes équipes (coachs et dirigeants)', vues: ['coach'], pour: (p) => p.coach, contenu: () => [
      P('L\'onglet « Mes équipes » montre quatre semaines d\'événements avec les réponses détaillées, motifs compris.'),
      L([B('+ Nouvel événement'), ' : match, tournoi, entraînement ou réunion ; lieu choisi par commune puis terrain.'],
        [B('Relancer'), ' les sans-réponse (au plus toutes les 6 heures).'],
        [B('Modifier'), ' ou ', B('Annuler'), ' : tous les convoqués sont notifiés. Un simple changement de casse du lieu ne notifie personne.'],
        [B('Composer les équipes A, B, C'), ' pour une équipe à sous-groupes (U12-U13).'],
        [B('Fiche du match'), ' : réponses, voitures, joueurs sans place, tâches. Elle vous est envoyée 24 h avant le match à partir du 4 janvier.'],
        [B('Tâches de match'), ' (en tête de l\'onglet) : garder ou retirer une tâche du club, ajouter une tâche propre à l\'équipe ; ', B('Confier à…'), ' depuis la carte du match.'],
        [B('Désigner un conducteur'), ' depuis le covoiturage : liste par joueur, avec ses parents.']),
      P('Pendant le pilote, SportEasy reste la source du calendrier (reprise chaque heure) ; ne demandez plus les présences dans SportEasy.'),
    ] },
    { id: 'partenaires', titre: 'Partenaires', vues: ['partenaires'], pour: (p) => p.partenaires, contenu: (p) => [
      P('L\'onglet « Partenaires » remplace l\'ancien module de l\'Espace club (en lecture seule).'),
      L([B('Tableau de bord'), ' : encaissé et attendu de la saison, comparaison avec la saison précédente, listes de travail.'],
        [B('Entreprises'), ' : fiche avec contrats, échéances, paiements, coordonnées, contacts, documents et historique.'],
        'Les listes de travail sont actionnables : action faite, mail pré-rempli, relance à 7 jours, renouvellement.',
        'Une entreprise fermée ou dont le contact est parti est archivée (avec un motif), jamais supprimée.'),
      p.codir && !p.commission && !p.admin ? P('Membre du CODIR : vous consultez ; les modifications sont faites par la commission partenaires.') : null,
      p.finances ? P(B('Contrôle compta'), ' : pour chaque écriture sans paiement, « Relier » crée le paiement, « Écarter » retire une écriture qui n\'est pas un partenariat (motif obligatoire).') : null,
      P('Vocabulaire : « partenaires », jamais « sponsors ».'),
    ] },
    { id: 'dons', titre: 'Dons et reçus fiscaux', vues: ['partenaires'], pour: (p) => p.commission || p.finances || p.secretariat || p.bureau, contenu: (p) => [
      P('Un don sans contrepartie donne un reçu fiscal (Cerfa 16216 entreprise, 11580 particulier). Un contrat avec panneau ou visibilité est du parrainage : facture, pas de reçu.'),
      p.bureau
        ? L([B('Aperçu du reçu'), ' : PDF officiel barré « non valable », pour vérifier.'],
            [B('Valider le reçu'), ' : numéro définitif AAAA-NNN, jamais libéré. Ne validez jamais un don de test.'],
            'À la validation, un e-mail avec le PDF signé part au trésorier, au secrétaire, aux présidents et à la commission.',
            [B('Envoyer par e-mail'), ' au donateur, depuis contact@ ; ', B('Annuler le reçu'), ' en cas d\'erreur (motif obligatoire), puis nouveau reçu.'],
            'Une demande de la commission arrive par e-mail aux présidents, au trésorier et au secrétaire : vérifiez, modifiez si besoin, puis validez.')
        : L([B('+ Demande de don'), ' : saisissez le donateur, le montant et le mode de paiement. Les présidents, le trésorier et le secrétaire sont prévenus par e-mail.'],
            'La validation, la signature et l\'envoi du reçu restent aux présidents, au trésorier et au secrétaire.',
            'Vous recevez par e-mail chaque reçu créé, avec le PDF.'),
      P('Pour une entreprise, l\'identité légale (raison sociale, SIREN, siège) vient de sa fiche : bouton « Identités à vérifier ».'),
    ] },
    { id: 'attestations', titre: 'Attestations de licence', vues: ['attestations'], pour: (p) => p.attestations, contenu: () => [
      P('Les demandes du formulaire « Nous contacter » arrivent chaque heure. Si le licencié est retrouvé avec certitude et la cotisation notée payée dans SportEasy, l\'attestation part seule.'),
      L('Sinon, la demande reste « à contrôler », avec le motif.',
        [B('C\'est bien ce licencié'), ' ou ', B('Rattacher'), ' quand le licencié n\'est pas retrouvé avec certitude.'],
        [B('Confirmer le paiement'), ' quand la cotisation n\'est pas notée (SumUp, famille, Pass Sport) ; corrigez aussi SportEasy.'],
        [B('Clore'), ' une demande en double ou sans objet : ne la supprimez pas, elle reviendrait.'],
        [B('Refuser'), ' envoie un e-mail au demandeur avec le motif.']),
    ] },
    { id: 'frais', titre: 'Frais des coachs', vues: ['frais'], pour: (p) => p.admin, contenu: () => [
      P('Relevé des trajets des coachs pour un reçu d\'abandon de frais. Le club ne rembourse pas : les frais lui sont abandonnés.'),
      L('Validez chaque trajet effectué ; la distance aller-retour est calculée par l\'IGN et reste modifiable.',
        'Renseignez la puissance fiscale du véhicule (case P.6 de la carte grise).',
        'Aucun reçu avant la délibération du CODIR autorisant le remboursement.'),
    ] },
    { id: 'apercu', titre: 'Voir en tant que', pour: (p) => p.roles.has('presidence') && !p.admin, contenu: () => [
      P('Le bouton « Voir en tant que », en haut de l\'écran, affiche l\'application telle qu\'un coach, un parent ou un joueur la voit : choisissez la personne, puis « Revenir à moi ».'),
      L('C\'est une lecture seule : aucun bouton n\'enregistre rien et personne n\'est prévenu.',
        'Chaque aperçu est noté dans le journal du club.',
        'Utile pour vérifier ce que voient les familles et les coachs avant de leur répondre.'),
    ] },
    { id: 'admin', titre: 'Administration', vues: ['admin'], pour: (p) => p.admin, contenu: () => [
      L([B('Onglet Administration'), ' : comptes ouverts et dernières connexions, personnes clés jamais connectées, adoption par équipe, activité des 7 derniers jours, points à traiter et derniers aperçus.'],
        [B('Voir en tant que'), ' : l\'application telle qu\'une personne la voit, en lecture seule, notée au journal.'],
        [B('Mises à jour SportEasy'), ' : chaque nuit, les écarts avec SportEasy deviennent des propositions à appliquer ou ignorer ; rien n\'est appliqué seul.'],
        'Sauvegarde nocturne de toute la base dans le Drive (Commission IT), avec les reçus et les attestations en PDF.',
        'Toute suppression de données se décide avec le responsable informatique.'),
    ] },
    { id: 'donnees', titre: 'Vos données', pour: () => true, contenu: () => [
      P('L\'application garde le minimum : ni adresse postale, ni date de naissance complète, ni numéro de licence pour la vie des équipes. Les moins de 15 ans n\'ont pas de coordonnées propres.'),
      P('Exceptions : l\'adresse des donateurs (reçu fiscal) et les licences de la saison (attestations), lisibles seulement par les présidents, le trésorier et le secrétaire.'),
    ] },
    { id: 'contact', titre: 'Besoin d\'aide ?', pour: () => true, contenu: (p) => [
      P(p.coach || p.famille ? 'Parlez-en d\'abord au coach de l\'équipe. ' : '', 'Pour un problème d\'accès ou de fonctionnement : Ronan Durand, responsable informatique du club, ou la rubrique « Nous contacter » du site.'),
    ] },
  ];
  const RUBRIQUE_VUE = { avenir: 'convocations', coach: 'equipes', partenaires: 'partenaires', attestations: 'attestations', frais: 'frais', admin: 'admin' };

  // ---------- Fenêtre ----------
  async function ouvrir() {
    const p = await profil();
    // RACI : bureau ; CODIR seulement si des lignes lui ont été ouvertes (visible_pour = 'codir')
    p.raci = p.bureau;
    if (!p.raci && p.codir) { const { count } = await sb.from('raci').select('id', { count: 'exact', head: true }); p.raci = (count || 0) > 0; }
    let onglet = 'aide';
    ouvrirFenetre('Aide', (f) => {
      f.classList.add('large');
      const corps = el('div', {});
      const nav = el('div', { class: 'p-onglets' });
      const dessinerNav = () => {
        nav.replaceChildren(...[['aide', 'Aide'], ...(p.raci ? [['raci', 'RACI']] : [])].map(([k, t]) =>
          el('button', { class: 'onglet' + (onglet === k ? ' actif' : ''), onclick: () => { onglet = k; dessinerNav(); dessiner(); } }, t)));
      };
      const dessiner = () => { if (onglet === 'raci') dessinerRaci(corps, p); else dessinerAide(corps, p); };
      dessinerNav(); dessiner();
      f.append(nav, corps, el('div', { class: 'boutons' }, el('button', { class: 'btn secondaire', onclick: fermerFenetre }, 'Fermer')));
    });
  }

  function profilLisible(p) {
    const l = [];
    if (p.admin) l.push('administrateur');
    if (p.bureau && !p.admin && !p.roles.has('presidence') && !p.finances && !p.secretariat) l.push('présidents, trésorier, secrétaire');
    if (p.roles.has('presidence')) l.push('présidence');
    if (p.finances) l.push('trésorier');
    if (p.secretariat) l.push('secrétariat');
    if (p.commission) l.push('commission partenaires');
    if (p.codir) l.push('CODIR');
    if (p.coach) l.push('coach ou dirigeant');
    if (p.famille) l.push('parent');
    if (p.joueur) l.push('joueur');
    return l.length ? l.join(', ') : 'membre du club';
  }

  function dessinerAide(z, p) {
    const actives = RUBRIQUES.filter(r => r.pour(p));
    const ouverte = RUBRIQUE_VUE[p.vue] && actives.some(r => r.id === RUBRIQUE_VUE[p.vue]) ? RUBRIQUE_VUE[p.vue] : 'debut';
    z.replaceChildren(el('p', { class: 'petit' }, 'Aide adaptée à votre profil : ' + profilLisible(p) + '.' + (p.apercu ? ' (Aperçu : profil de la personne observée.)' : '')));
    for (const r of actives) {
      const d = el('details', { class: 'aide-rubrique' }, el('summary', {}, r.titre), el('div', { class: 'aide-texte' }, r.contenu(p)));
      if (r.id === ouverte) d.open = true;
      z.append(d);
    }
  }

  // ---------- RACI ----------
  const LETTRES = [['r', 'R', 'Réalise'], ['a', 'A', 'Approuve'], ['c', 'C', 'Consulté'], ['i', 'I', 'Informé']];
  const separer = (t) => (t || '').split(',').map(x => x.trim()).filter(Boolean);
  let filtre = null;
  async function dessinerRaci(z, p) {
    z.replaceChildren(el('p', { class: 'petit' }, 'Chargement du RACI...'));
    const [{ data: lignes, error }, { data: fonctions }, { data: club }] = await Promise.all([
      sb.from('raci').select('*').order('ordre'),
      sb.from('raci_fonctions').select('*').order('ordre'),
      sb.from('clubs').select('raci_note').limit(1)]);
    if (error) { z.replaceChildren(el('p', { class: 'vide' }, 'RACI indisponible : ' + error.message)); return; }
    if (!lignes || !lignes.length) { z.replaceChildren(el('p', { class: 'vide' }, 'Aucune ligne de RACI visible pour votre profil.')); return; }
    // Fonctions de la personne ; le « Comité directeur » n'est retenu que pour un membre du CODIR hors bureau
    const mesFonctions = (fonctions || []).filter(f => f.role_lie && p.roles.has(f.role_lie) && !(f.role_lie === 'codir' && p.bureau)).map(f => f.fonction);
    const note = ((club || [])[0] || {}).raci_note;
    z.replaceChildren(
      el('p', { class: 'petit' }, 'Qui fait quoi entre les présidents, le trésorier, le secrétaire et les commissions. ', B('R'), ' réalise, ', B('A'), ' approuve et rend compte (une seule fonction), ', B('C'), ' est consulté avant, ', B('I'), ' est informé après.' + (note ? ' ' + note : '')));
    // Filtre par fonction
    const puces = el('div', { class: 'raci-filtres' });
    const liste = el('div', { class: 'raci-liste' });
    const choisir = (f) => { filtre = f; dessinerPuces(); dessinerListe(); };
    const dessinerPuces = () => puces.replaceChildren(
      el('button', { class: 'raci-puce' + (!filtre ? ' actif' : ''), onclick: () => choisir(null) }, 'Tout'),
      mesFonctions.length ? el('button', { class: 'raci-puce' + (filtre === '*moi' ? ' actif' : ''), onclick: () => choisir('*moi') }, 'Mes responsabilités') : null,
      ...(fonctions || []).map(f => el('button', { class: 'raci-puce' + (filtre === f.fonction ? ' actif' : ''), title: f.titulaires || '', onclick: () => choisir(f.fonction) }, f.fonction)));
    const cibles = () => filtre === '*moi' ? mesFonctions : filtre ? [filtre] : [];
    const dessinerListe = () => {
      liste.replaceChildren();
      const c = cibles();
      const visibles = lignes.filter(l => !c.length || LETTRES.some(([k]) => separer(l[k]).some(x => c.includes(x))));
      if (!visibles.length) { liste.append(el('p', { class: 'vide' }, 'Aucune activité pour cette fonction.')); return; }
      let domaine = null;
      for (const l of visibles) {
        if (l.domaine !== domaine) { domaine = l.domaine; liste.append(el('h4', { class: 'raci-domaine' }, domaine)); }
        liste.append(el('div', { class: 'raci-carte' },
          el('div', { class: 'raci-activite' }, l.activite),
          el('div', { class: 'raci-lignes' }, LETTRES.map(([k, lettre, sens]) => {
            const noms = separer(l[k]);
            return el('div', { class: 'raci-ligne' + (noms.some(x => c.includes(x)) ? ' moi' : '') },
              el('span', { class: 'raci-lettre raci-' + k, title: sens }, lettre),
              el('span', {}, noms.length ? noms.join(', ') : '-'));
          })),
          l.precisions ? el('div', { class: 'petit raci-precision' }, l.precisions) : null));
      }
    };
    dessinerPuces(); dessinerListe();
    const legende = el('details', { class: 'aide-rubrique' }, el('summary', {}, 'Qui occupe chaque fonction'),
      el('div', { class: 'aide-texte' }, el('ul', {}, (fonctions || []).map(f => el('li', {}, B(f.fonction), f.titulaires ? ' : ' + f.titulaires : '')))));
    z.append(puces, liste, legende,
      el('p', { class: 'petit' }, 'Les modifications du RACI se décident en réunion des présidents, du trésorier et du secrétaire, puis sont reportées par le responsable informatique.'));
  }

  return { ouvrir };
}
