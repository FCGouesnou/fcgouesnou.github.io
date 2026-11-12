/*
  FC Gouesnou - Espace club
  Fichier : espace/partenaires.js (dépôt GitHub fcgouesnou.github.io)
  Rôle : onglet « Partenaires » - liste des entreprises et fiche (coordonnées, contacts, contrats,
         échéances par saison, paiements, documents, historique des actions, mail).
         Lecture : CODIR et commission partenaires ; modification : commission et administrateurs
         (droits appliqués par la base, l'écran ne fait que les refléter).
  Version : 1.0 - 12/11/2026 - première version (reprise du module Partenaires de l'Espace club Apps Script)
*/

export function initPartenaires(ctx) {
  const { sb, el, toast } = ctx;
  const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const eur = (v) => v === null || v === undefined || v === '' ? '-' : euros.format(Number(v));
  const dateFr = (iso) => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
  const S = { peutModifier: false, clubId: null, saison: null, entreprises: [], listes: {}, modeles: [], filtre: '', statut: 'actifs', zone: null };

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
    dessinerListe();
  }
  function dessinerListe() {
    const zone = S.zone; zone.replaceChildren();
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

  async function nouvelleEntreprise() {
    const nom = prompt('Nom de la nouvelle entreprise :'); if (!nom || !nom.trim()) return;
    const { data: refs } = await sb.from('part_entreprises').select('ref').like('ref', 'P%');
    const n = Math.max(0, ...(refs || []).map(r => parseInt(r.ref.slice(1), 10) || 0)) + 1;
    const { data, error } = await sb.from('part_entreprises').insert({ club_id: S.clubId, ref: 'P' + String(n).padStart(3, '0'), nom: nom.trim(), statut: 'Prospect' }).select('id').single();
    if (error) { toast('Erreur : ' + error.message); return; }
    await chargerListe(); dessinerListe(); ouvrirFiche(data.id);
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
      const sections = [['Contrats et paiements', () => sectionContrats(e, contrats || [], ecritures || [])],
                        ['Coordonnées', () => sectionCoordonnees(e, contacts || [])],
                        ['Historique', () => sectionHistorique(e, actions || [], contacts || [])],
                        ['Documents', () => sectionDocuments(docs || [])]];
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
  async function rafraichir(id) { await chargerListe(); if (S.zone) dessinerListe(); ouvrirFiche(id); }

  // Contrats, échéances et paiements
  function sectionContrats(e, contrats, ecritures) {
    const z = el('div', {});
    if (S.peutModifier) z.append(el('button', { class: 'mini', onclick: () => formContrat(e, null) }, '+ Contrat'));
    if (!contrats.length) z.append(el('p', { class: 'vide' }, 'Aucun contrat.'));
    for (const c of contrats) {
      const ech = (c.echeances || []).sort((a, b) => a.saison.localeCompare(b.saison) || a.objet.localeCompare(b.objet));
      const bloc = el('div', { class: 'p-contrat' },
        el('div', { class: 'p-contrat-tete' },
          el('strong', {}, c.ref + ' - ' + (c.formule || 'sans formule')),
          el('span', { class: 'petit' }, [c.montant_annuel ? eur(c.montant_annuel) + ' par saison' : 'montant non renseigné',
            c.saison_debut + (c.duree_saisons > 1 ? ', ' + c.duree_saisons + ' saisons' : ''), c.statut, c.nature].filter(Boolean).join(' · ')),
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
            S.peutModifier ? el('button', { class: 'mini', onclick: () => formPaiement(e, c, x, null) }, '+ Paiement') : null),
          marque(x.a_verifier),
          x.a_verifier && S.peutModifier ? el('button', { class: 'mini', onclick: () => verifie('part_echeances', x.id, e.id) }, 'Vérifié') : null,
          pays.map(p => el('div', { class: 'p-paiement' },
            el('span', {}, eur(p.montant) + ' le ' + dateFr(p.date_reception) + (p.moyen ? ' · ' + p.moyen : '') +
              (p.ecriture ? ' · ' + p.ecriture : '') + (p.exercice ? ' · exercice ' + p.exercice : '')),
            marque(p.a_verifier),
            S.peutModifier ? el('span', { class: 'p-boutons' },
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
      el('a', { class: 'mini', href: 'https://drive.google.com/file/d/' + d.drive_id + '/view', target: '_blank', rel: 'noopener' }, 'Ouvrir')));
    z.append(el('p', { class: 'petit' }, 'Les documents restent dans le Drive partagé « Commission partenaires » ; leur ouverture demande un compte du club ayant accès à ce Drive.'));
    return z;
  }

  // Mail : le modèle s'ouvre dans la messagerie de la personne connectée
  function ecrire(e, contact) {
    fenetre('Écrire à ' + e.nom, (f) => {
      const a = (contact && contact.email) || e.email;
      const sel = el('select', { class: 'champ' }, el('option', { value: '' }, 'Mail libre'), S.modeles.map(m => el('option', { value: m.code }, m.code + ' - ' + (m.usage || ''))));
      const objet = entree(''); const texte = zoneTexte('', 10);
      const remplacer = (t) => (t || '').replaceAll('{{Civilité}}', (contact && contact.civilite) || '').replaceAll('{{Nom}}', (contact && contact.nom) || '')
        .replaceAll('{{Prénom}}', (contact && contact.prenom) || '').replaceAll('{{Entreprise}}', e.nom || '').replaceAll('{{Référent}}', e.referent || '')
        .replace(/ {2,}/g, ' ');
      sel.addEventListener('change', () => { const m = S.modeles.find(x => x.code === sel.value); objet.value = remplacer(m && m.objet); texte.value = remplacer(m && m.texte); });
      f.append(el('p', { class: 'petit' }, 'Destinataire : ' + a), champ('Modèle', sel), champ('Objet', objet), champ('Texte', texte),
        el('div', { class: 'boutons' }, el('button', { class: 'btn secondaire', onclick: () => ouvrirFiche(e.id) }, 'Retour'),
          el('button', { class: 'btn principal', onclick: () => {
            location.href = 'mailto:' + encodeURIComponent(a) + '?subject=' + encodeURIComponent(objet.value) + '&body=' + encodeURIComponent(texte.value);
            if (S.peutModifier && sel.value) sb.from('part_actions').insert({ club_id: S.clubId, entreprise_id: e.id, type: 'Mail', statut: 'Fait',
              date_prevue: new Date().toISOString().slice(0, 10), date_realisee: new Date().toISOString().slice(0, 10),
              objet: objet.value, modele_mail: sel.value, contact: contact ? [contact.prenom, contact.nom].filter(Boolean).join(' ') : null });
          } }, 'Ouvrir dans ma messagerie')));
    });
  }

  return { initialiser, afficher };
}
