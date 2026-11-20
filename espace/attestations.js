/* =====================================================================
  Espace club - module « Attestations » (espace/attestations.js)
  Rôle : attestations de licence (comités d'entreprise...) pour le trésorier, le secrétaire et les
         administrateurs : demandes du formulaire du site ou saisies, contrôle automatique (licencié
         retrouvé, cotisation payée), actions du bureau (rattacher, confirmer le paiement, clore,
         refuser), et vue des licences de la saison (cotisations).
         Les demandes et les licences sont chargées chaque heure par l'Espace club (Apps Script,
         « 11 - Attestations Espace club.gs ») et la fonction Edge « attestations ».
  Version : 1.0.1 - 20/11/2026 - bouton « C'est bien ce licencié » quand le licencié est retrouvé avec un doute
            1.0 - 20/11/2026 - première version (étape 2 : sans PDF ni envoi)
===================================================================== */
export function initAttestations(ctx) {
  const { sb, el, toast } = ctx;
  const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const eur = (v) => v === null || v === undefined || v === '' ? '-' : euros.format(Number(v));
  const dateFr = (iso) => iso ? String(iso).slice(8, 10) + '/' + String(iso).slice(5, 7) + '/' + String(iso).slice(0, 4) : '';
  const cle = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '');
  const S = { ok: false, clubId: null, saison: null, vue: 'demandes', filtre: 'à traiter', q: '', demandes: [], licences: new Map(), zone: null };
  const saisonDe = (d = new Date()) => { const y = d.getFullYear(), m = d.getMonth() + 1; return m >= 7 ? y + '-' + (y + 1) : (y - 1) + '-' + y; };

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
  async function action(nom, params, ok) {
    const { error } = await sb.rpc(nom, params);
    if (error) { toast('Erreur : ' + error.message); return false; }
    if (ok) toast(ok);
    await charger(); dessiner();
    return true;
  }

  // ---------- Chargement ----------
  async function initialiser() {
    const { data: roles } = await sb.rpc('mes_roles');
    const r = roles || [];
    S.ok = r.some(x => ['admin', 'finances', 'secretariat'].includes(x.role));
    S.clubId = (r[0] || {}).club_id || null;
    S.saison = saisonDe();
    return S.ok;
  }
  async function charger() {
    const [{ data: d, error: e1 }, { data: l, error: e2 }] = await Promise.all([
      sb.from('attestations').select('*').order('recue_le', { ascending: false }),
      sb.from('licences').select('*').eq('saison', S.saison).order('nom').order('prenom')]);
    if (e1 || e2) { toast('Erreur : ' + (e1 || e2).message); return; }
    S.demandes = d || [];
    S.licences = new Map((l || []).map(x => [x.numero_personne, x]));
  }
  async function afficher(zone) {
    S.zone = zone;
    zone.replaceChildren(el('p', { class: 'petit' }, 'Chargement des attestations...'));
    await charger();
    dessiner();
  }
  function dessiner() {
    const zone = S.zone; if (!zone) return;
    zone.replaceChildren();
    const nav = el('div', { class: 'p-onglets' });
    [['demandes', 'Demandes'], ['licences', 'Licences ' + S.saison]].forEach(([v, t]) => nav.append(el('button', {
      class: 'onglet' + (S.vue === v ? ' actif' : ''), onclick: () => { S.vue = v; dessiner(); } }, t)));
    const corps = el('div', {});
    zone.append(nav, corps);
    if (S.vue === 'licences') dessinerLicences(corps); else dessinerDemandes(corps);
  }

  // ---------- Demandes ----------
  const PASTILLE = { 'à contrôler': 'p-match', 'prête': 'p-entrainement', 'envoyée': 'p-entrainement', 'antérieure': 'p-autre', 'refusée': 'p-autre', 'annulée': 'p-autre' };
  const LIBELLE = { 'à contrôler': 'À contrôler', 'prête': 'Prête', 'envoyée': 'Envoyée', 'antérieure': 'Envoyée (ancien circuit)', 'refusée': 'Refusée', 'annulée': 'Close' };
  function dessinerDemandes(zone) {
    const n = (st) => S.demandes.filter(d => d.statut === st).length;
    zone.append(el('div', { class: 'p-resume' },
      el('div', {}, el('strong', {}, String(n('à contrôler'))), el('span', {}, 'à contrôler')),
      el('div', {}, el('strong', {}, String(n('prête'))), el('span', {}, 'prêtes à envoyer')),
      el('div', {}, el('strong', {}, String(n('envoyée') + n('antérieure'))), el('span', {}, 'envoyées')),
      el('div', {}, el('strong', {}, String(n('refusée') + n('annulée'))), el('span', {}, 'refusées ou closes'))));
    zone.append(el('p', { class: 'petit' }, 'Demandes du formulaire du site, reprises chaque heure, et demandes saisies ici. ' +
      'Une demande est « prête » quand le licencié est retrouvé (nom, prénom, date de naissance) et que sa cotisation est payée dans SportEasy. ' +
      'Montant : total réglé (licence et survêtement). L\'envoi des attestations sera ouvert à l\'étape suivante.'));
    const recherche = entree(S.q, { placeholder: 'Rechercher un nom, un demandeur, un numéro' });
    const filtres = { 'à traiter': 'À traiter', 'envoyées': 'Envoyées', 'refusées': 'Refusées et closes', 'toutes': 'Toutes' };
    const sel = el('select', { class: 'champ' }, Object.entries(filtres).map(([v, t]) => el('option', { value: v, selected: v === S.filtre }, t)));
    const liste = el('div', { class: 'p-liste' });
    zone.append(el('div', { class: 'p-barre' }, recherche, sel, el('button', { class: 'mini', onclick: () => formSaisie() }, '+ Demande')), liste);
    const remplir = () => {
      const q = cle(S.q);
      const l = S.demandes.filter(d =>
        (S.filtre === 'toutes' || (S.filtre === 'à traiter' ? ['à contrôler', 'prête'].includes(d.statut)
          : S.filtre === 'envoyées' ? ['envoyée', 'antérieure'].includes(d.statut) : ['refusée', 'annulée'].includes(d.statut))) &&
        (!q || cle([d.joueur_nom, d.joueur_prenom, d.demandeur_nom, d.demandeur_prenom, d.demandeur_email, d.numero].join(' ')).includes(q)));
      liste.replaceChildren(...(l.length ? l.map(carte) : [el('p', { class: 'vide' }, 'Aucune demande.')]));
    };
    recherche.addEventListener('input', () => { S.q = recherche.value; remplir(); });
    sel.addEventListener('change', () => { S.filtre = sel.value; remplir(); });
    remplir();
  }

  function carte(d) {
    const lic = d.numero_personne ? S.licences.get(d.numero_personne) : null;
    const ouverte = ['à contrôler', 'prête'].includes(d.statut);
    const histo = el('div', { class: 'petit', hidden: true },
      (d.historique || []).slice().reverse().map(h => el('div', {}, dateFr((h.le || '').slice(0, 10)) + ' - ' + h.quoi)));
    const actions = el('div', { class: 'actions-coach' });
    if (ouverte) {
      if (d.numero_personne && d.rapprochement === 'à vérifier' && lic) actions.append(el('button', { class: 'mini principal', onclick: () =>
        action('attestation_rattacher', { p_id: d.id, p_numero: d.numero_personne }, 'Licencié confirmé : ' + lic.nom + ' ' + lic.prenom + '.') }, 'C\'est bien ce licencié'));
      actions.append(el('button', { class: 'mini', onclick: () => formRattacher(d) }, d.numero_personne ? 'Changer de licencié' : 'Rattacher au licencié'));
      if (d.numero_personne && d.statut !== 'prête' && d.rapprochement !== 'à vérifier') actions.append(el('button', { class: 'mini principal', onclick: () => confirmerPaiement(d, lic) }, 'Confirmer le paiement'));
      actions.append(el('button', { class: 'mini', onclick: () => clore(d) }, 'Clore'),
        el('button', { class: 'mini danger', onclick: () => refuser(d) }, 'Refuser'));
    }
    actions.append(el('button', { class: 'mini', onclick: () => { histo.hidden = !histo.hidden; } }, 'Historique'));
    return el('div', { class: 'evt' },
      el('div', { class: 'p-ligne-info' },
        el('span', { class: 'pastille ' + (PASTILLE[d.statut] || 'p-autre') }, LIBELLE[d.statut] || d.statut),
        d.numero ? el('span', { class: 'petit' }, 'N° ' + d.numero) : null,
        d.montant != null ? el('span', { class: 'petit' }, eur(d.montant)) : null),
      el('h3', { style: 'margin:6px 0 2px' }, [d.joueur_nom, d.joueur_prenom].filter(Boolean).join(' ') || '(joueur non indiqué)',
        d.joueur_naissance ? el('small', { class: 'petit' }, ' - né(e) le ' + dateFr(d.joueur_naissance)) : null),
      el('p', { class: 'petit' }, 'Demande du ' + dateFr(d.recue_le) + ' par ' + [d.demandeur_prenom, d.demandeur_nom].filter(Boolean).join(' ') +
        (d.demandeur_email ? ' (' + d.demandeur_email + ')' : '') + (d.source === 'saisie' ? ' - saisie dans l\'application' : '')),
      lic ? el('p', { class: 'petit' }, 'Licencié : ' + lic.nom + ' ' + lic.prenom + (lic.naissance ? ', né(e) le ' + dateFr(lic.naissance) : '') +
        (lic.sous_categorie ? ' - ' + lic.sous_categorie : '') + ' - cotisation ' + (lic.statut_cotisation || 'non notée') + (lic.cout != null ? ', ' + eur(lic.cout) : '') +
        (lic.type_paiement ? ' (' + lic.type_paiement + ')' : '') + (d.rapprochement === 'confirmé' ? ' - rattaché à la main' : '')) : null,
      d.controle ? el('p', {}, el('span', { class: ouverte && d.statut !== 'prête' ? 'p-marque' : 'petit' }, d.controle)) : null,
      d.motif_refus ? el('p', { class: 'petit' }, 'Motif : ' + d.motif_refus) : null,
      actions, histo);
  }

  // Choisir un licencié de la saison (recherche par nom)
  function choisirLicencie(titre, init, suite) {
    fenetre(titre, (f) => {
      const q = entree(init, { placeholder: 'Nom ou prénom du licencié' });
      const res = el('div', { class: 'p-liste' });
      const maj = () => {
        const t = cle(q.value).split(' ').filter(Boolean);
        const l = [...S.licences.values()].filter(x => t.length && t.every(m => cle(x.nom + ' ' + x.prenom).includes(m))).slice(0, 30);
        res.replaceChildren(...(l.length ? l.map(x => el('button', { class: 'p-ligne', onclick: () => suite(x) },
          el('div', { class: 'p-ligne-nom' }, x.nom + ' ' + x.prenom, el('small', {}, [x.naissance ? 'né(e) le ' + dateFr(x.naissance) : 'date de naissance inconnue', x.sous_categorie, x.equipes].filter(Boolean).join(' · '))),
          el('div', { class: 'p-ligne-info' }, el('span', { class: 'pastille ' + (/^pay/i.test(x.statut_cotisation || '') ? 'p-entrainement' : 'p-match') }, x.statut_cotisation || 'Non notée'),
            x.cout != null ? el('span', { class: 'petit' }, eur(x.cout)) : null)))
          : [el('p', { class: 'vide' }, t.length ? 'Aucun licencié ne correspond.' : 'Tapez un nom.')]));
      };
      q.addEventListener('input', maj);
      f.append(q, res, el('div', { class: 'boutons' }, el('button', { class: 'btn secondaire', onclick: fermer }, 'Annuler')));
      maj(); q.focus();
    });
  }
  function formRattacher(d) {
    choisirLicencie('Rattacher la demande de ' + [d.joueur_nom, d.joueur_prenom].filter(Boolean).join(' '), [d.joueur_nom, d.joueur_prenom].filter(Boolean).join(' '),
      async (x) => { fermer(); await action('attestation_rattacher', { p_id: d.id, p_numero: x.numero_personne }, 'Demande rattachée à ' + x.nom + ' ' + x.prenom + '.'); });
  }
  async function confirmerPaiement(d, lic) {
    const proposition = d.montant ?? (lic && lic.cout) ?? '';
    const v = prompt('Montant réglé par la famille pour ' + (lic ? lic.prenom + ' ' + lic.nom : 'ce licencié') + ' (licence et survêtement), en euros :', proposition === '' ? '' : String(proposition).replace('.', ','));
    if (v === null) return;
    const m = Number(String(v).replace(/\s/g, '').replace(',', '.'));
    if (!(m > 0)) { toast('Montant invalide.'); return; }
    if (!confirm('Confirmer que la cotisation de ' + eur(m) + ' a bien été encaissée ? Pensez à la noter aussi dans SportEasy.')) return;
    await action('attestation_confirmer', { p_id: d.id, p_montant: m }, 'Paiement confirmé : la demande est prête.');
  }
  async function clore(d) {
    const motif = prompt('Clore cette demande sans envoyer d\'attestation (doublon, demande sans objet...). Motif :', 'Doublon');
    if (motif === null) return;
    await action('attestation_clore', { p_id: d.id, p_motif: motif }, 'Demande close.');
  }
  async function refuser(d) {
    const motif = prompt('Motif du refus (il sera communiqué au demandeur) :', 'Nous n\'avons pas trouvé les informations nécessaires à la délivrance de cette attestation. Merci de nous contacter par la rubrique « Nous contacter » du site.');
    if (motif === null) return;
    await action('attestation_refuser', { p_id: d.id, p_motif: motif }, 'Demande refusée. Pendant cette étape, le demandeur n\'est pas encore prévenu automatiquement.');
  }

  // Saisie d'une demande reçue autrement (mail, au club)
  function formSaisie() {
    choisirLicencie('Nouvelle demande : choisir le licencié', '', (x) => {
      fenetre('Demande pour ' + x.prenom + ' ' + x.nom, (f) => {
        const prenom = entree('', { placeholder: 'Prénom' }), nom = entree('', { placeholder: 'Nom' });
        const email = entree('', { type: 'email', placeholder: 'Adresse e-mail où envoyer l\'attestation' });
        f.append(el('p', { class: 'petit' }, 'Licencié : ' + x.nom + ' ' + x.prenom + (x.naissance ? ', né(e) le ' + dateFr(x.naissance) : '') + ' - cotisation ' + (x.statut_cotisation || 'non notée') + (x.cout != null ? ', ' + eur(x.cout) : '')),
          champ('Demandeur', el('div', { class: 'p-deux' }, prenom, nom)), champ('E-mail', email),
          el('div', { class: 'boutons' }, el('button', { class: 'btn secondaire', onclick: fermer }, 'Annuler'),
            el('button', { class: 'btn principal', onclick: async () => {
              const e = email.value.trim().toLowerCase();
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast('Adresse e-mail invalide.'); return; }
              const { data, error } = await sb.from('attestations').insert({
                club_id: S.clubId, saison: S.saison, source: 'saisie', demandeur_prenom: prenom.value.trim() || null, demandeur_nom: nom.value.trim() || null,
                demandeur_email: e, joueur_nom: x.nom, joueur_prenom: x.prenom, joueur_naissance: x.naissance,
                historique: [{ le: new Date().toISOString(), quoi: 'Demande saisie dans l\'application' }] }).select('id').single();
              if (error) { toast('Erreur : ' + error.message); return; }
              fermer();
              await action('attestation_rattacher', { p_id: data.id, p_numero: x.numero_personne }, 'Demande enregistrée.');
            } }, 'Enregistrer')));
      });
    });
  }

  // ---------- Licences de la saison ----------
  function dessinerLicences(zone) {
    const tous = [...S.licences.values()];
    const groupe = (x) => /^pay/i.test(x.statut_cotisation || '') ? 'Payé' : x.statut_cotisation || 'Non notée';
    const compte = {}; tous.forEach(x => { const g = groupe(x); compte[g] = (compte[g] || 0) + 1; });
    zone.append(el('div', { class: 'p-resume' }, Object.entries(compte).sort((a, b) => b[1] - a[1]).map(([g, n]) =>
      el('div', {}, el('strong', {}, String(n)), el('span', {}, g)))));
    const maj = tous.reduce((m, x) => x.maj_le > m ? x.maj_le : m, '');
    zone.append(el('p', { class: 'petit' }, tous.length + ' licenciés (FootClubs et SportEasy, reliés par le numéro de personne FFF), mis à jour le ' + dateFr(maj.slice(0, 10)) +
      '. Cotisation et montant : SportEasy. Vue réservée au trésorier, au secrétaire et aux administrateurs.'));
    const recherche = entree('', { placeholder: 'Rechercher un licencié, une équipe' });
    const groupes = ['Tous', ...Object.keys(compte)];
    const sel = el('select', { class: 'champ' }, groupes.map(g => el('option', { value: g, selected: g === (S.groupe || 'Tous') }, g)));
    const liste = el('div', { class: 'p-liste' });
    zone.append(el('div', { class: 'p-barre' }, recherche, sel), liste);
    const remplir = () => {
      const t = cle(recherche.value).split(' ').filter(Boolean);
      const l = tous.filter(x => (sel.value === 'Tous' || groupe(x) === sel.value) &&
        (!t.length || t.every(m => cle([x.nom, x.prenom, x.equipes, x.sous_categorie].join(' ')).includes(m))));
      liste.replaceChildren(...(l.length ? l.slice(0, 200).map(x => el('div', { class: 'p-ligne' },
        el('div', { class: 'p-ligne-nom' }, x.nom + ' ' + x.prenom, el('small', {}, [x.naissance ? dateFr(x.naissance) : null, x.sous_categorie, x.type_licence, x.equipes].filter(Boolean).join(' · '))),
        el('div', { class: 'p-ligne-info' },
          el('span', { class: 'pastille ' + (groupe(x) === 'Payé' ? 'p-entrainement' : groupe(x) === 'Non notée' ? 'p-match' : 'p-autre') }, groupe(x)),
          x.cout != null ? el('span', { class: 'petit' }, eur(x.cout)) : null,
          !x.dans_footclubs ? el('span', { class: 'p-marque' }, 'absent de FootClubs') : null)))
        : [el('p', { class: 'vide' }, 'Aucun licencié.')]));
    };
    recherche.addEventListener('input', remplir);
    sel.addEventListener('change', () => { S.groupe = sel.value; remplir(); });
    remplir();
  }

  return { initialiser, afficher };
}
