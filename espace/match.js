/*
  FC Gouesnou - Espace club
  Fichier : espace/match.js (dépôt GitHub fcgouesnou.github.io)
  Rôle : direct du match et statistiques des joueurs.
         - Direct : tableau de score, fil du match (buts avec buteur et passeur, buts adverses, remplacements,
           cartons, notes), composition de départ, délégué du jour. Saisie par les coachs, dirigeants,
           administrateurs et le délégué désigné par le coach ; lecture par toute l'équipe et les présidents.
           Actualisation automatique toutes les 30 secondes pendant que la fenêtre est ouverte.
         - Photos du match : chacun dépose ses photos (réduites dans le navigateur : 1600 px et miniature 480 px) ;
           visibles de l'équipe après validation par l'encadrement (coachs, dirigeants, délégué), dont les photos
           sont validées d'office ; copiées chaque nuit dans le Drive de photos@ (fonction match_photos et suivantes).
         - Statistiques : bilan, buteurs, passeurs, temps de jeu, cartons, présence aux entraînements, matchs
           de la saison. Toute l'équipe pour les coachs, administrateurs et présidents ; chaque joueur et sa
           famille seulement pour lui (contrôlé par la base : fonctions match_direct et stats_equipe).
  Version : 1.5 - 21/11/2026 - composition : titulaires et remplaçants choisis dès le départ (match_groupe_enregistrer)
            1.4 - 21/11/2026 - listes du direct : « Sur le terrain » puis « Remplaçants » une fois la composition enregistrée ; remplacement : sortant parmi le terrain, entrant parmi les remplaçants
            1.3 - 21/11/2026 - listes de joueurs limitées aux convoqués non absents (toute l'équipe sur demande dans la composition) ; titulaires en vert
            1.2 - 21/11/2026 - photos du match (dépôt, validation par l'encadrement, visionneuse)
            1.1 - 21/11/2026 - matchs sans heure (minuit, « Horaire à confirmer ») : pas de minute calculée, statut « Jour de match »
            1.0 - 21/11/2026 - première version
*/
export function initMatch({ sb, el, ouvrirFenetre, fermerFenetre, toast, enApercu }) {
  const FUSEAU = 'Europe/Paris';
  const fmtJour = new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, weekday: 'short', day: 'numeric', month: 'short' });
  const LIB = { but: 'But', but_adverse: 'But adverse', remplacement: 'Remplacement', jaune: 'Carton jaune', rouge: 'Carton rouge', note: 'Note' };
  const ICONE = { but: '⚽', but_adverse: '⚽', remplacement: '⇄', jaune: '', rouge: '', note: '✎' };
  let suivi = null; // minuterie d'actualisation du direct

  const erreur = (e) => toast('Erreur : ' + (e.message || e));
  const fmtHM = new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' });
  const fmtCle = new Intl.DateTimeFormat('fr-CA', { timeZone: FUSEAU });
  const sansHeure = (d) => fmtHM.format(new Date(d.evt.debut)) === '00:00';
  function minuteCourante(d) {
    if (sansHeure(d)) return null;
    const m = Math.floor((Date.now() - new Date(d.evt.debut)) / 60000);
    if (m < 0) return null;
    return Math.min(m, d.evt.duree + 30);
  }
  function statut(d) {
    const m = minuteCourante(d);
    if (d.evt.etat === 'annule') return 'Annulé';
    if (sansHeure(d)) {
      const j = fmtCle.format(new Date(d.evt.debut)), auj = fmtCle.format(new Date());
      return j === auj ? 'Jour de match · horaire à confirmer' : j > auj ? 'À venir · horaire à confirmer' : 'Terminé';
    }
    if (m === null) return 'À venir';
    if (m <= d.evt.duree + 20) return 'En cours · ' + Math.min(m, d.evt.duree) + 'e';
    return 'Terminé';
  }

  // ---------- Direct du match ----------
  async function ouvrirDirect(ev) {
    const { data: d, error } = await sb.rpc('match_direct', { ev });
    if (error) { erreur(error); return; }
    const lecture = enApercu();
    const saisie = d.peut_saisir && !lecture;
    let mode = 'fil';
    const nomEquipe = d.evt.equipe, adv = d.evt.adversaire || 'Adversaire';
    const [gauche, droite] = d.evt.domicile === false ? [adv, nomEquipe] : [nomEquipe, adv];
    const [sg, sd] = d.evt.domicile === false ? [d.score.eux, d.score.nous] : [d.score.nous, d.score.eux];

    ouvrirFenetre('Direct du match', (f) => {
      f.classList.add('large');
      const corps = el('div', {});
      f.append(
        el('div', { class: 'direct-score' },
          el('div', { class: 'direct-equipe' }, gauche),
          el('div', { class: 'direct-chiffres' }, el('b', {}, String(sg)), el('span', {}, '-'), el('b', {}, String(sd))),
          el('div', { class: 'direct-equipe' }, droite),
          el('div', { class: 'direct-statut' }, statut(d) + ' · ' + fmtJour.format(new Date(d.evt.debut)))),
        corps,
        el('div', { class: 'boutons' },
          el('button', { class: 'btn secondaire', onclick: () => { fermerSuivi(); ouvrirPhotos(ev, nomEquipe + ' - ' + adv); } }, '📷 Photos'),
          el('button', { class: 'btn secondaire', onclick: () => ouvrirStats(d.evt.equipe_id, nomEquipe) }, 'Statistiques'),
          el('button', { class: 'btn secondaire', onclick: arreterEtFermer }, 'Fermer')));
      dessiner();

      function dessiner() {
        corps.replaceChildren();
        if (mode !== 'fil') return;
        if (saisie) {
          corps.append(el('div', { class: 'direct-actions' },
            [['but', '⚽ But'], ['but_adverse', 'But adverse'], ['remplacement', '⇄ Remplacement'], ['jaune', 'Carton jaune'], ['rouge', 'Carton rouge'], ['note', '✎ Note']]
              .map(([t, l]) => el('button', { class: 'direct-btn direct-' + t, onclick: () => formulaire(t) }, l))));
        }
        // Fil du match
        corps.append(el('h4', { class: 'p-titre' }, 'Fil du match'));
        if (!d.faits.length) corps.append(el('p', { class: 'vide' }, saisie ? 'Rien pour l\'instant : touchez un bouton ci-dessus à chaque action.' : 'Aucune action saisie pour l\'instant.'));
        const fil = el('div', { class: 'direct-fil' });
        for (const x of d.faits.slice().reverse()) {
          const texte = x.type === 'but' ? (x.joueur ? x.joueur : 'But (contre son camp adverse)') + (x.passeur ? ' · passe de ' + x.passeur : '')
            : x.type === 'but_adverse' ? 'But de ' + adv
            : x.type === 'remplacement' ? x.joueur + ' entre, ' + x.sortant + ' sort'
            : x.type === 'note' ? (x.commentaire || '') : (x.joueur || '');
          fil.append(el('div', { class: 'direct-ligne direct-l-' + x.type },
            el('span', { class: 'direct-minute' }, x.minute != null ? x.minute + '\'' : '-'),
            el('span', { class: 'direct-icone ' + x.type }, ICONE[x.type]),
            el('span', { class: 'direct-texte' }, el('strong', {}, LIB[x.type]), el('span', {}, texte),
              x.commentaire && x.type !== 'note' ? el('small', {}, x.commentaire) : null),
            saisie ? el('button', { class: 'direct-suppr', title: 'Supprimer', onclick: async () => {
              if (!confirm('Supprimer cette action ?')) return;
              const { error: e2 } = await sb.rpc('match_fait_supprimer', { p_id: x.id });
              if (e2) { erreur(e2); return; }
              await recharger();
            } }, '×') : null));
        }
        corps.append(fil);
        // Composition : titulaires (temps de jeu depuis le coup d'envoi) et remplaçants choisis dès le départ
        const tit = new Set(d.titulaires);
        const remp = new Set(d.remplacants || []);
        const compo = el('details', { class: 'aide-rubrique' }, el('summary', {}, 'Composition (' + tit.size + ' titulaire' + (tit.size > 1 ? 's' : '') + (remp.size ? ' + ' + remp.size + ' remplaçant' + (remp.size > 1 ? 's' : '') : '') + ')'));
        if (saisie) {
          let toute = false;
          const puces = el('div', { class: 'raci-filtres direct-compo' });
          const etat = new Map([...tit].map(id => [id, 't']).concat([...remp].map(id => [id, 'r'])));
          const bascule = el('button', { class: 'lien-mini' });
          const compte = el('p', { class: 'petit compo-compte' });
          const dessinerPuces = () => {
            puces.replaceChildren(...proposes(toute).map(j => {
              const e = etat.get(j.id);
              return el('button', {
                class: 'raci-puce' + (e === 't' ? ' actif' : e === 'r' ? ' remp' : ''),
                onclick: () => { const x = etat.get(j.id); x === 't' ? etat.set(j.id, 'r') : x === 'r' ? etat.delete(j.id) : etat.set(j.id, 't'); dessinerPuces(); } },
                (e === 't' ? '✓ ' : e === 'r' ? 'R · ' : '') + j.nom + (j.reponse === 'absent' ? ' (absent)' : !j.reponse ? ' (non convoqué)' : ''));
            }));
            const nt = [...etat.values()].filter(v => v === 't').length, nr = [...etat.values()].filter(v => v === 'r').length;
            compte.textContent = nt + ' titulaire' + (nt > 1 ? 's' : '') + ' · ' + nr + ' remplaçant' + (nr > 1 ? 's' : '');
            bascule.textContent = toute ? 'Ne montrer que les convoqués' : 'Afficher toute l\'équipe';
          };
          bascule.onclick = () => { toute = !toute; dessinerPuces(); };
          dessinerPuces();
          compo.append(el('div', { class: 'aide-texte' },
            el('p', { class: 'petit' }, 'Touchez un joueur : 1 fois = titulaire (vert), 2 fois = remplaçant (orange), 3 fois = retiré. Le temps de jeu d\'un remplaçant compte à partir de son entrée (bouton « Remplacement »). ', bascule),
            puces, compte,
            el('button', { class: 'mini principal', onclick: async () => {
              const t = [...etat].filter(([, v]) => v === 't').map(([k]) => k), r = [...etat].filter(([, v]) => v === 'r').map(([k]) => k);
              const { error: e3 } = await sb.rpc('match_groupe_enregistrer', { ev, p_titulaires: t, p_remplacants: r });
              if (e3) { erreur(e3); return; }
              toast(t.length + ' titulaire(s) et ' + r.length + ' remplaçant(s) enregistrés.'); await recharger();
            } }, 'Enregistrer la composition')));
        } else {
          compo.append(el('div', { class: 'aide-texte' }, tit.size ? 'Titulaires : ' + d.joueurs.filter(j => tit.has(j.id)).map(j => j.nom).join(', ')
            + (remp.size ? '. Remplaçants : ' + d.joueurs.filter(j => remp.has(j.id)).map(j => j.nom).join(', ') : '') + '.' : 'Pas encore renseignée.'));
        }
        corps.append(compo);
        // Délégué du jour (coachs)
        if (d.est_coach && !lecture) {
          const det = el('details', { class: 'aide-rubrique' }, el('summary', {}, 'Délégué du match : ' + (d.delegue ? d.delegue.nom : 'aucun')));
          const zone = el('div', { class: 'aide-texte' }, el('p', { class: 'petit' }, 'Un parent ou un dirigeant peut saisir le direct à votre place. Il est prévenu par notification.'));
          det.append(zone);
          det.addEventListener('toggle', async () => {
            if (!det.open || zone.dataset.charge) return;
            zone.dataset.charge = '1';
            const { data: cand } = await sb.rpc('taches_candidats', { ev });
            const liste = (cand || []).filter(c => c.coach || c.joueur).sort((a, b) => (b.coach - a.coach) || (a.joueur || '').localeCompare(b.joueur || '', 'fr') || a.nom.localeCompare(b.nom, 'fr'));
            const sel = el('select', { class: 'champ' }, el('option', { value: '' }, 'Aucun délégué'),
              liste.map(c => el('option', { value: c.personne_id, selected: d.delegue && d.delegue.id === c.personne_id }, c.nom + (c.coach ? ' (encadrement)' : ' (parent de ' + c.joueur + ')'))));
            zone.append(sel, el('button', { class: 'mini principal', onclick: async () => {
              const { error: e4 } = await sb.rpc('match_delegue', { ev, p_personne: sel.value || null });
              if (e4) { erreur(e4); return; }
              toast(sel.value ? 'Délégué désigné et prévenu.' : 'Délégué retiré.'); await recharger();
            } }, 'Enregistrer'));
          });
          corps.append(det);
        } else if (d.delegue) corps.append(el('p', { class: 'petit' }, 'Délégué du match : ' + d.delegue.nom + '.'));
        if (lecture) corps.append(el('p', { class: 'petit' }, 'Aperçu en lecture seule.'));
      }
      // Joueurs proposés : les convoqués qui n'ont pas répondu « absent » (toute l'équipe si personne n'est convoqué),
      // plus les titulaires déjà choisis
      function proposes(tout) {
        const conv = d.joueurs.filter(j => j.reponse && j.reponse !== 'absent');
        const base = tout || !conv.length ? d.joueurs : conv;
        const ids = new Set(base.map(j => j.id));
        return base.concat(d.joueurs.filter(j => !ids.has(j.id) && d.titulaires.includes(j.id)))
          .sort((a, b) => rang(a) - rang(b) || a.nom.localeCompare(b.nom, 'fr'));
      }
      function rang(j) { return { present: 0, incertain: 1, sans_reponse: 2 }[j.reponse] ?? (j.reponse === 'absent' ? 4 : 3); }

      // Formulaire d'une action
      function formulaire(type) {
        mode = 'form'; dessiner();
        const joueurs = proposes(false);
        const tit = new Set(d.titulaires);
        // Joueurs sur le terrain : titulaires, plus les entrants, moins les sortants (dans l'ordre du fil)
        const parNom = new Map(d.joueurs.map(j => [j.nom, j.id]));
        const terrain = new Set(tit);
        for (const f of d.faits.filter(x => x.type === 'remplacement')) {
          if (f.sortant && parNom.has(f.sortant)) terrain.delete(parNom.get(f.sortant));
          if (f.joueur_id) terrain.add(f.joueur_id);
        }
        const opt = (j) => el('option', { value: j.id }, j.nom + (j.reponse === 'absent' ? ' (absent)' : ''));
        // groupe : 'tous' (sur le terrain puis remplaçants), 'terrain' ou 'banc'
        const rempl = new Set(d.remplacants || []);
        const selJ = (vide, groupe = 'tous') => {
          const sur = joueurs.filter(j => terrain.has(j.id));
          const banc = joueurs.filter(j => !terrain.has(j.id) && (!rempl.size || rempl.has(j.id)));
          const autres = rempl.size ? joueurs.filter(j => !terrain.has(j.id) && !rempl.has(j.id)) : [];
          const s = el('select', { class: 'champ' }, el('option', { value: '' }, vide));
          if (!terrain.size) { joueurs.forEach(j => s.append(opt(j))); return s; }
          if (groupe !== 'banc' && sur.length) s.append(el('optgroup', { label: 'Sur le terrain' }, sur.map(opt)));
          if (groupe !== 'terrain' && banc.length) s.append(el('optgroup', { label: 'Remplaçants' }, banc.map(opt)));
          if (groupe !== 'terrain' && autres.length) s.append(el('optgroup', { label: 'Autres convoqués' }, autres.map(opt)));
          return s;
        };
        const m = minuteCourante(d);
        const minute = el('input', { class: 'champ', type: 'number', min: 0, max: 150, inputmode: 'numeric', value: m === null ? '' : String(Math.min(m, d.evt.duree)) });
        const com = el('input', { class: 'champ', maxlength: 200, placeholder: type === 'note' ? 'Ex. belle action collective, blessure...' : 'Précision (facultatif)' });
        let j1 = null, j2 = null;
        const champs = [];
        if (type === 'but') { j1 = selJ('Buteur (vide : contre son camp adverse)'); j2 = selJ('Passeur (facultatif)'); champs.push(lib('Buteur', j1), lib('Passe décisive', j2)); }
        if (type === 'remplacement') {
          j2 = selJ('Joueur qui sort', 'terrain'); j1 = selJ('Joueur qui entre', 'banc');
          champs.push(lib('Sort', j2), lib('Entre', j1));
        }
        if (type === 'jaune' || type === 'rouge') { j1 = selJ('Joueur'); champs.push(lib('Joueur', j1)); }
        const zone = el('div', { class: 'direct-form' }, el('h4', { class: 'p-titre' }, LIB[type]), ...champs, lib('Minute', minute), lib(type === 'note' ? 'Note' : 'Précision', com),
          el('div', { class: 'boutons' },
            el('button', { class: 'btn secondaire', onclick: () => { mode = 'fil'; dessiner(); } }, 'Annuler'),
            el('button', { class: 'btn principal', onclick: async (e) => {
              const b = e.currentTarget; b.disabled = true;
              const args = { ev, p_type: type, p_minute: minute.value === '' ? null : Number(minute.value),
                p_joueur: type === 'remplacement' ? (j1.value || null) : (j1 ? j1.value || null : null),
                p_passeur: type === 'but' ? (j2.value || null) : null,
                p_sortant: type === 'remplacement' ? (j2.value || null) : null, p_commentaire: com.value || null };
              if (type === 'note' && !args.p_commentaire) { toast('Écrivez la note.'); b.disabled = false; return; }
              if (type === 'but' && args.p_joueur && args.p_joueur === args.p_passeur) { toast('Le passeur doit être différent du buteur.'); b.disabled = false; return; }
              const { error: e5 } = await sb.rpc('match_fait_ajouter', args);
              if (e5) { erreur(e5); b.disabled = false; return; }
              toast(LIB[type] + ' enregistré.'); mode = 'fil'; await recharger();
            } }, 'Enregistrer')));
        corps.replaceChildren(zone);
      }
      function lib(t, champ) { return el('label', { class: 'direct-champ' }, el('span', {}, t), champ); }

      async function recharger() {
        const { data: n, error: e6 } = await sb.rpc('match_direct', { ev });
        if (e6) { erreur(e6); return; }
        if (!document.body.contains(f)) return;
        if (mode !== 'fil') { Object.assign(d, n); return; }
        fermerSuivi(); ouvrirDirect(ev);
      }
      fermerSuivi();
      suivi = setInterval(() => { if (!document.body.contains(f)) { fermerSuivi(); return; } if (mode === 'fil' && !f.querySelector('details[open]')) recharger(); }, 30000);
    });
  }
  // ---------- Photos du match ----------
  function reduire(fichier, max, qualite) {
    return new Promise((ok, ko) => {
      const img = new Image(); const url = URL.createObjectURL(fichier);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(b => b ? ok({ blob: b, largeur: c.width, hauteur: c.height }) : ko(new Error('Photo illisible')), 'image/jpeg', qualite);
      };
      img.onerror = () => { URL.revokeObjectURL(url); ko(new Error('Format de photo non reconnu')); };
      img.src = url;
    });
  }
  async function liens(chemins) {
    if (!chemins.length) return {};
    const { data } = await sb.storage.from('photos').createSignedUrls(chemins, 3600);
    const m = {}; (data || []).forEach(x => { if (x.signedUrl) m[x.path] = x.signedUrl; }); return m;
  }
  async function ouvrirPhotos(ev, titre) {
    const { data: d, error } = await sb.rpc('match_photos', { ev });
    if (error) { erreur(error); return; }
    const lecture = enApercu();
    const photos = d.photos || [];
    const urls = await liens(photos.map(p => p.miniature));
    const attente = photos.filter(p => p.statut === 'a_valider');
    ouvrirFenetre('Photos du match', (f) => {
      f.classList.add('large');
      const entree = el('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none' });
      const etat = el('p', { class: 'petit' });
      entree.addEventListener('change', async () => {
        const liste = [...entree.files].slice(0, 20); entree.value = '';
        if (!liste.length) return;
        let n = 0;
        for (const [i, fi] of liste.entries()) {
          etat.textContent = 'Envoi de la photo ' + (i + 1) + ' sur ' + liste.length + '...';
          try {
            const [grande, mini] = [await reduire(fi, 1600, 0.82), await reduire(fi, 480, 0.75)];
            const id = crypto.randomUUID();
            const chemin = ev + '/' + id + '.jpg', miniature = ev + '/' + id + '_m.jpg';
            const up1 = await sb.storage.from('photos').upload(chemin, grande.blob, { contentType: 'image/jpeg' });
            if (up1.error) throw up1.error;
            const up2 = await sb.storage.from('photos').upload(miniature, mini.blob, { contentType: 'image/jpeg' });
            if (up2.error) { await sb.storage.from('photos').remove([chemin]); throw up2.error; }
            const { error: e2 } = await sb.rpc('match_photo_ajouter', { ev, p_chemin: chemin, p_miniature: miniature, p_largeur: grande.largeur, p_hauteur: grande.hauteur, p_legende: null });
            if (e2) { await sb.storage.from('photos').remove([chemin, miniature]); throw e2; }
            n++;
          } catch (e) { toast('Photo ' + (i + 1) + ' non envoyée : ' + (e.message || e)); }
        }
        toast(n + ' photo(s) envoyée(s)' + (d.peut_valider ? '.' : ' : visibles de l\'équipe après validation du coach.'));
        ouvrirPhotos(ev, titre);
      });
      const grille = (liste) => el('div', { class: 'photos-grille' }, liste.map(p => el('figure', { class: 'photo-carte' + (p.statut === 'a_valider' ? ' attente' : '') },
        el('img', { src: urls[p.miniature] || '', alt: p.legende || 'Photo du match', loading: 'lazy', onclick: () => visionneuse(p, photos) }),
        p.statut === 'a_valider' ? el('span', { class: 'photo-badge' }, 'À valider') : null,
        d.peut_valider && !lecture && p.statut === 'a_valider' ? el('div', { class: 'photo-actions' },
          el('button', { class: 'mini principal', onclick: () => valider(p) }, 'Valider'),
          el('button', { class: 'mini danger', onclick: () => supprimer(p, 'Refuser cette photo ? Elle sera supprimée.') }, 'Refuser')) : null)));
      const validees = photos.filter(p => p.statut === 'validee');
      f.append(
        el('p', { class: 'petit' }, titre + '. ' + (d.peut_valider
          ? 'Vos photos sont visibles tout de suite ; celles des familles attendent votre accord.'
          : 'Vos photos seront visibles de l\'équipe après validation du coach.')),
        lecture ? el('p', { class: 'petit' }, 'Aperçu en lecture seule.') : el('div', { class: 'photos-depot' },
          el('button', { class: 'btn principal', onclick: () => entree.click() }, '📷 Ajouter des photos'), entree, etat,
          el('p', { class: 'petit' }, 'Photos réservées à l\'équipe et au club. Respectez le choix des familles qui ne souhaitent pas que leur enfant soit photographié.')),
        attente.length ? el('h4', { class: 'p-titre' }, (d.peut_valider ? 'À valider' : 'En attente de validation') + ' (' + attente.length + ')') : null,
        attente.length ? grille(attente) : null,
        d.peut_valider && attente.length > 1 && !lecture ? el('button', { class: 'mini principal', onclick: async () => { for (const p of attente) await sb.rpc('match_photo_valider', { p_id: p.id, p_ok: true }); toast(attente.length + ' photos validées.'); ouvrirPhotos(ev, titre); } }, 'Tout valider') : null,
        el('h4', { class: 'p-titre' }, 'Photos du match (' + validees.length + ')'),
        validees.length ? grille(validees) : el('p', { class: 'vide' }, 'Aucune photo pour l\'instant.'),
        el('div', { class: 'boutons' }, el('button', { class: 'btn secondaire', onclick: () => ouvrirDirect(ev) }, 'Retour au direct'),
          el('button', { class: 'btn secondaire', onclick: fermerFenetre }, 'Fermer')));
    });
    async function valider(p) {
      const { error: e } = await sb.rpc('match_photo_valider', { p_id: p.id, p_ok: true });
      if (e) { erreur(e); return; }
      toast('Photo validée.'); ouvrirPhotos(ev, titre);
    }
    async function supprimer(p, question) {
      if (!confirm(question)) return;
      const { data: fichiers, error: e } = await sb.rpc('match_photo_supprimer', { p_id: p.id });
      if (e) { erreur(e); return; }
      if (fichiers && fichiers.length) await sb.storage.from('photos').remove(fichiers);
      toast('Photo supprimée.'); document.querySelector('.photo-zoom')?.remove(); ouvrirPhotos(ev, titre);
    }
    async function visionneuse(p, tous) {
      const l = await liens([p.chemin]);
      const peutSuppr = !lecture && (d.peut_valider || (p.mienne && p.statut !== 'validee'));
      const fond = el('div', { class: 'aide-zoom photo-zoom', onclick: (e) => { if (e.target === fond) fond.remove(); } },
        el('button', { class: 'fermer-x', 'aria-label': 'Fermer', onclick: () => fond.remove() }, '×'),
        el('img', { src: l[p.chemin] || urls[p.miniature], alt: p.legende || 'Photo du match' }),
        el('p', {}, (p.auteur ? 'Photo de ' + p.auteur : 'Photo du match') + (p.statut === 'a_valider' ? ' · à valider' : '')),
        el('div', { class: 'photo-zoom-actions' },
          l[p.chemin] ? el('a', { class: 'mini', href: l[p.chemin], download: 'photo-match.jpg', target: '_blank', rel: 'noopener' }, 'Télécharger') : null,
          peutSuppr ? el('button', { class: 'mini danger', onclick: () => supprimer(p, 'Supprimer cette photo ?') }, 'Supprimer') : null));
      document.body.append(fond);
    }
  }

  function fermerSuivi() { if (suivi) { clearInterval(suivi); suivi = null; } }
  function arreterEtFermer() { fermerSuivi(); fermerFenetre(); }

  // ---------- Statistiques ----------
  async function ouvrirStats(equipe, nom) {
    fermerSuivi();
    const { data: s, error } = await sb.rpc('stats_equipe', { p_equipe: equipe });
    if (error) { erreur(error); return; }
    let tri = 'buts';
    ouvrirFenetre('Statistiques - ' + (nom || ''), (f) => {
      f.classList.add('large');
      const saisis = s.matchs.filter(m => m.saisi);
      const v = saisis.filter(m => m.nous > m.eux).length, n = saisis.filter(m => m.nous === m.eux).length, dfaite = saisis.filter(m => m.nous < m.eux).length;
      const bp = saisis.reduce((a, m) => a + m.nous, 0), bc = saisis.reduce((a, m) => a + m.eux, 0);
      const meilleur = s.tout ? s.joueurs.slice().sort((a, b) => b.buts - a.buts)[0] : null;
      f.append(el('p', { class: 'petit' }, 'Saison depuis le ' + new Date(s.depuis).toLocaleDateString('fr-FR') + '. Seuls les matchs saisis dans le direct comptent.' +
          (s.tout ? '' : ' Vous voyez les chiffres de votre enfant ou les vôtres ; ceux de toute l\'équipe sont réservés aux coachs.')),
        el('div', { class: 'p-resume' },
          el('div', {}, el('strong', {}, String(saisis.length)), el('span', {}, 'matchs saisis')),
          el('div', {}, el('strong', {}, v + ' - ' + n + ' - ' + dfaite), el('span', {}, 'victoires, nuls, défaites')),
          el('div', {}, el('strong', {}, bp + ' / ' + bc), el('span', {}, 'buts marqués / encaissés')),
          meilleur && meilleur.buts ? el('div', {}, el('strong', {}, meilleur.nom.split(' ')[0] + ' · ' + meilleur.buts), el('span', {}, 'meilleur buteur')) : null));
      if (s.tout && s.joueurs.some(j => j.buts || j.passes)) {
        f.append(graphe('Buteurs', s.joueurs.filter(j => j.buts).sort((a, b) => b.buts - a.buts).slice(0, 8), 'buts', ''),
          graphe('Passeurs', s.joueurs.filter(j => j.passes).sort((a, b) => b.passes - a.passes).slice(0, 8), 'passes', ''));
      }
      if (s.joueurs.some(j => j.minutes)) f.append(graphe('Temps de jeu', s.joueurs.filter(j => j.minutes).sort((a, b) => b.minutes - a.minutes), 'minutes', ' min'));
      // Tableau triable
      const zoneTab = el('div', { class: 'stats-tableau' });
      const COLS = [['nom', 'Joueur'], ['mj', 'MJ'], ['tit', 'Tit.'], ['minutes', 'Min'], ['buts', 'Buts'], ['passes', 'PD'], ['jaunes', 'CJ'], ['rouges', 'CR'], ['presence', 'Entr.']];
      const dessinerTab = () => {
        const lignes = s.joueurs.map(j => ({ ...j, presence: j.ent_total ? Math.round(100 * j.ent_present / j.ent_total) : null }))
          .sort((a, b) => tri === 'nom' ? a.nom.localeCompare(b.nom, 'fr') : (b[tri] ?? -1) - (a[tri] ?? -1));
        zoneTab.replaceChildren(el('table', {},
          el('thead', {}, el('tr', {}, COLS.map(([k, l]) => el('th', { class: tri === k ? 'actif' : '', onclick: () => { tri = k; dessinerTab(); } }, l)))),
          el('tbody', {}, lignes.map(j => el('tr', {}, COLS.map(([k]) => el('td', {}, k === 'presence' ? (j.presence === null ? '-' : j.presence + ' %') : String(j[k]))))))));
      };
      dessinerTab();
      f.append(el('h4', { class: 'p-titre' }, 'Par joueur'), zoneTab,
        el('p', { class: 'petit' }, 'MJ : matchs joués · Tit. : titularisations · PD : passes décisives · CJ, CR : cartons · Entr. : présence aux entraînements passés.'));
      // Matchs de la saison
      f.append(el('h4', { class: 'p-titre' }, 'Matchs'));
      if (!s.matchs.length) f.append(el('p', { class: 'vide' }, 'Aucun match cette saison.'));
      for (const m of s.matchs) {
        const res = !m.saisi ? 'non saisi' : m.nous + ' - ' + m.eux;
        const cl = !m.saisi ? 'nd' : m.nous > m.eux ? 'v' : m.nous === m.eux ? 'n' : 'd';
        f.append(el('button', { class: 'p-ligne', onclick: () => ouvrirDirect(m.id) },
          el('div', { class: 'p-ligne-nom' }, (m.domicile === false ? 'chez ' : 'contre ') + (m.adversaire || 'adversaire'),
            el('small', {}, fmtJour.format(new Date(m.debut)) + (m.titre ? ' · ' + m.titre : ''))),
          el('span', { class: 'stats-res ' + cl }, res)));
      }
      f.append(el('div', { class: 'boutons' }, el('button', { class: 'btn secondaire', onclick: fermerFenetre }, 'Fermer')));
    });
  }
  function graphe(titre, lignes, champ, unite) {
    const max = Math.max(1, ...lignes.map(l => l[champ]));
    return el('div', { class: 'stats-graphe' }, el('h4', { class: 'p-titre' }, titre),
      ...lignes.map(l => el('div', { class: 'stats-barre' },
        el('span', { class: 'stats-nom' }, l.nom),
        el('span', { class: 'stats-piste' }, el('span', { style: 'width:' + Math.max(4, Math.round(100 * l[champ] / max)) + '%' })),
        el('span', { class: 'stats-val' }, l[champ] + unite))));
  }

  return { ouvrirDirect, ouvrirStats, ouvrirPhotos, fermerSuivi };
}
