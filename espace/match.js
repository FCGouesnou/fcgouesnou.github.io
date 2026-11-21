/*
  FC Gouesnou - Espace club
  Fichier : espace/match.js (dépôt GitHub fcgouesnou.github.io)
  Rôle : direct du match et statistiques des joueurs.
         - Direct : tableau de score, fil du match (buts avec buteur et passeur, buts adverses, remplacements,
           cartons, notes), composition de départ, délégué du jour. Saisie par les coachs, dirigeants,
           administrateurs et le délégué désigné par le coach ; lecture par toute l'équipe et les présidents.
           Actualisation automatique toutes les 30 secondes pendant que la fenêtre est ouverte.
         - Statistiques : bilan, buteurs, passeurs, temps de jeu, cartons, présence aux entraînements, matchs
           de la saison. Toute l'équipe pour les coachs, administrateurs et présidents ; chaque joueur et sa
           famille seulement pour lui (contrôlé par la base : fonctions match_direct et stats_equipe).
  Version : 1.0 - 21/11/2026 - première version
*/
export function initMatch({ sb, el, ouvrirFenetre, fermerFenetre, toast, enApercu }) {
  const FUSEAU = 'Europe/Paris';
  const fmtJour = new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, weekday: 'short', day: 'numeric', month: 'short' });
  const LIB = { but: 'But', but_adverse: 'But adverse', remplacement: 'Remplacement', jaune: 'Carton jaune', rouge: 'Carton rouge', note: 'Note' };
  const ICONE = { but: '⚽', but_adverse: '⚽', remplacement: '⇄', jaune: '', rouge: '', note: '✎' };
  let suivi = null; // minuterie d'actualisation du direct

  const erreur = (e) => toast('Erreur : ' + (e.message || e));
  function minuteCourante(d) {
    const m = Math.floor((Date.now() - new Date(d.evt.debut)) / 60000);
    if (m < 0) return null;
    return Math.min(m, d.evt.duree + 30);
  }
  function statut(d) {
    const m = minuteCourante(d);
    if (d.evt.etat === 'annule') return 'Annulé';
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
        // Composition de départ
        const tit = new Set(d.titulaires);
        const compo = el('details', { class: 'aide-rubrique' }, el('summary', {}, 'Composition de départ (' + tit.size + ')'));
        if (saisie) {
          const presents = d.joueurs.slice().sort((a, b) => rang(a) - rang(b) || a.nom.localeCompare(b.nom, 'fr'));
          const puces = el('div', { class: 'raci-filtres direct-compo' });
          const choix = new Set(tit);
          const dessinerPuces = () => puces.replaceChildren(...presents.map(j => el('button', {
            class: 'raci-puce' + (choix.has(j.id) ? ' actif' : ''),
            onclick: () => { choix.has(j.id) ? choix.delete(j.id) : choix.add(j.id); dessinerPuces(); } },
            j.nom + (j.reponse === 'absent' ? ' (absent)' : ''))));
          dessinerPuces();
          compo.append(el('div', { class: 'aide-texte' },
            el('p', { class: 'petit' }, 'Touchez les joueurs qui commencent le match : le temps de jeu en dépend.'), puces,
            el('button', { class: 'mini principal', onclick: async () => {
              const { error: e3 } = await sb.rpc('match_titulaires_enregistrer', { ev, p_ids: [...choix] });
              if (e3) { erreur(e3); return; }
              toast(choix.size + ' titulaire(s) enregistré(s).'); await recharger();
            } }, 'Enregistrer la composition')));
        } else {
          compo.append(el('div', { class: 'aide-texte' }, tit.size ? d.joueurs.filter(j => tit.has(j.id)).map(j => j.nom).join(', ') : 'Pas encore renseignée.'));
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
      function rang(j) { return { present: 0, incertain: 1, sans_reponse: 2 }[j.reponse] ?? (j.reponse === 'absent' ? 4 : 3); }

      // Formulaire d'une action
      function formulaire(type) {
        mode = 'form'; dessiner();
        const joueurs = d.joueurs.slice().sort((a, b) => rang(a) - rang(b) || a.nom.localeCompare(b.nom, 'fr'));
        const tit = new Set(d.titulaires);
        const selJ = (vide, filtre) => el('select', { class: 'champ' }, el('option', { value: '' }, vide),
          joueurs.filter(filtre || (() => true)).map(j => el('option', { value: j.id }, j.nom + (j.reponse === 'absent' ? ' (absent)' : ''))));
        const m = minuteCourante(d);
        const minute = el('input', { class: 'champ', type: 'number', min: 0, max: 150, inputmode: 'numeric', value: m === null ? '' : String(Math.min(m, d.evt.duree)) });
        const com = el('input', { class: 'champ', maxlength: 200, placeholder: type === 'note' ? 'Ex. belle action collective, blessure...' : 'Précision (facultatif)' });
        let j1 = null, j2 = null;
        const champs = [];
        if (type === 'but') { j1 = selJ('Buteur (vide : contre son camp adverse)'); j2 = selJ('Passeur (facultatif)'); champs.push(lib('Buteur', j1), lib('Passe décisive', j2)); }
        if (type === 'remplacement') {
          j2 = selJ('Joueur qui sort'); j1 = selJ('Joueur qui entre');
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

  return { ouvrirDirect, ouvrirStats, fermerSuivi };
}
