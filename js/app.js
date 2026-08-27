// js/app.js
import { CONFIG } from './config.js';
import { fetchCSV } from './csvParser.js';

document.addEventListener("DOMContentLoaded", async () => {
  const mainContainer = document.getElementById('main');
  
  mainContainer.innerHTML = `
    <div style="text-align:center; padding:50px; color:var(--gold); font-family:'JetBrains Mono', monospace;">
      Fetching 24 Teams TW FPL Data & Tie-Breaker Engine...
    </div>`;

  const standingsResponse = await fetchCSV(CONFIG.STANDINGS_CSV_URL, "Standings Sheet");
  const matchesResponse = await fetchCSV(CONFIG.MATCHES_CSV_URL, "Matches Sheet");

  if (standingsResponse.error || matchesResponse.error) {
    mainContainer.innerHTML = `
      <div style="text-align:center; padding: 40px; background: rgba(239, 68, 68, 0.1); border: 1px solid var(--danger); border-radius: 8px; margin-top: 20px;">
        <h3 style="color: var(--danger); font-family: 'Anton', sans-serif; letter-spacing: 1px; margin-bottom: 16px;">⚠️ Data Connection Error</h3>
        <div style="color: var(--text); font-family: 'JetBrains Mono', monospace; font-size: 14px; line-height: 1.8;">
          ${standingsResponse.error ? `<p>${standingsResponse.error}</p>` : ''}
          ${matchesResponse.error ? `<p>${matchesResponse.error}</p>` : ''}
        </div>
      </div>
    `;
    return; 
  }

  const validStandings = standingsResponse.data
    .filter(team => team.team_name && team.team_name.toString().trim() !== "")
    .map(team => ({
      team_name: team.team_name,
      mp: 0, w: 0, d: 0, l: 0, fpl_pts: 0, pts: 0
    }));

  const matchesData = matchesResponse.data;

  // Auto-calculation for League Phase (Week 2 to 5)
  matchesData.forEach(match => {
    const stage = match.stage ? match.stage.toString().trim().toLowerCase() : "";
    if (stage.startsWith('wk')) {
      const homeScore = match.home_score;
      const awayScore = match.away_score;
      const hasScore = homeScore !== "" && homeScore !== undefined && homeScore !== null &&
                       awayScore !== "" && awayScore !== undefined && awayScore !== null;

      if (hasScore) {
        const homeTeam = validStandings.find(t => t.team_name === match.home_team);
        const awayTeam = validStandings.find(t => t.team_name === match.away_team);

        if (homeTeam && awayTeam) {
          const hPts = Number(homeScore);
          const aPts = Number(awayScore);

          homeTeam.mp += 1;
          awayTeam.mp += 1;
          homeTeam.fpl_pts += hPts;
          awayTeam.fpl_pts += aPts;

          if (hPts > aPts) {
            homeTeam.w += 1;
            homeTeam.pts += 3;
            awayTeam.l += 1;
          } else if (hPts < aPts) {
            awayTeam.w += 1;
            awayTeam.pts += 3;
            homeTeam.l += 1;
          } else {
            homeTeam.d += 1;
            homeTeam.pts += 1;
            awayTeam.d += 1;
            awayTeam.pts += 1;
          }
        }
      }
    }
  });

  // Tie-breaker: Pts -> FPL Pts
  const sortedStandings = [...validStandings].sort((a, b) => {
    if (b.pts !== a.pts) return (b.pts || 0) - (a.pts || 0);
    return (b.fpl_pts || 0) - (a.fpl_pts || 0);
  });

  const getMatches = (stageKey) => {
    return matchesData.filter(m => {
      const stage = m.stage ? m.stage.toString().trim().toLowerCase() : "";
      return stage === stageKey.toLowerCase() && m.home_team && m.home_team.toString().trim() !== "";
    });
  };

  // Render Standings (Top 16 Advance)
  function renderStandings() {
    if (sortedStandings.length === 0) {
      return `
        <div class="stagehead"><h2>League Phase Standings</h2></div>
        <div style="text-align:center; padding:40px; color:var(--text-dim); font-family:'JetBrains Mono', monospace;">
          Data is empty. Please add rows in Google Sheets.
        </div>`;
    }

    let rowsHtml = sortedStandings.map((team, i) => {
      const rank = i + 1;
      const isQualifying = rank <= 16;
      const rowClass = isQualifying ? 'qualify-row' : 'out-row';
      const statusTag = isQualifying ? '<span class="status-tag tag-q">TOP 16</span>' : '';

      return `
        <tr class="${rowClass}">
          <td><span class="rank-badge">${rank}</span></td>
          <td><strong>${team.team_name}</strong></td>
          <td style="text-align:center;">${team.mp}</td>
          <td style="text-align:center; color: var(--success);">${team.w}</td>
          <td style="text-align:center; color: var(--text-dim);">${team.d}</td>
          <td style="text-align:center; color: var(--danger);">${team.l}</td>
          <td style="text-align:right; font-weight:700; color: var(--gold);">${team.fpl_pts}</td>
          <td style="text-align:right; font-weight:700; font-size:16px;">${team.pts}</td>
          <td style="text-align:center;">${statusTag}</td>
        </tr>
      `;
    }).join("");

    return `
      <div class="stagehead">
        <h2>League Phase Standings</h2>
        <div class="stagesub">24 TEAMS · TOP 16 ADVANCE TO ROUND OF 16 (8 MATCHES)</div>
      </div>
      <div class="table-wrap">
        <table class="standings-table">
          <thead>
            <tr>
              <th style="width:40px;">#</th>
              <th>Team</th>
              <th style="text-align:center;">MP</th>
              <th style="text-align:center;">W</th>
              <th style="text-align:center;">D</th>
              <th style="text-align:center;">L</th>
              <th style="text-align:right;">FPL Pts</th>
              <th style="text-align:right;">Pts</th>
              <th style="text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  function extractScores(match) {
    let hScore = match.home_score;
    let aScore = match.away_score;

    if ((hScore === "" || hScore === undefined || hScore === null) && 
        (aScore === "" || aScore === undefined || aScore === null)) {
      const keys = Object.keys(match);
      const numericVals = keys
        .filter(k => !['stage', 'home_team', 'away_team', 'home_cap', 'away_cap', 'home_vc', 'away_vc', 'home_gk', 'away_gk', 'home_prev', 'away_prev'].includes(k))
        .map(k => match[k])
        .filter(v => v !== "" && v !== undefined && v !== null && !isNaN(Number(v)));
      
      if (numericVals.length >= 2) {
        hScore = numericVals[0];
        aScore = numericVals[1];
      }
    }
    return { hScore, aScore };
  }

  // Knockout Tie-Breaker Logic Evaluator
  function evaluateKnockoutWinner(match) {
    const { hScore, aScore } = extractScores(match);
    if (hScore === "" || hScore === undefined || hScore === null || aScore === "" || aScore === undefined || aScore === null) {
      return { winner: null, method: null };
    }

    const hNum = Number(hScore);
    const aNum = Number(aScore);

    if (hNum > aNum) return { winner: match.home_team, method: 'Score' };
    if (aNum > hNum) return { winner: match.away_team, method: 'Score' };

    // --- TIE-BREAKER SEQUENCE ---
    const hCap = Number(match.home_cap || 0);
    const aCap = Number(match.away_cap || 0);
    if (hCap > aCap) return { winner: match.home_team, method: 'Captain Pts' };
    if (aCap > hCap) return { winner: match.away_team, method: 'Captain Pts' };

    const hVc = Number(match.home_vc || 0);
    const aVc = Number(match.away_vc || 0);
    if (hVc > aVc) return { winner: match.home_team, method: 'Vice-Captain Pts' };
    if (aVc > hVc) return { winner: match.away_team, method: 'Vice-Captain Pts' };

    const hGk = Number(match.home_gk || 0);
    const aGk = Number(match.away_gk || 0);
    if (hGk > aGk) return { winner: match.home_team, method: 'Goalkeeper Pts' };
    if (aGk > hGk) return { winner: match.away_team, method: 'Goalkeeper Pts' };

    const hPrev = Number(match.home_prev || 0);
    const aPrev = Number(match.away_prev || 0);
    if (hPrev > aPrev) return { winner: match.home_team, method: 'Previous GW Pts' };
    if (aPrev > hPrev) return { winner: match.away_team, method: 'Previous GW Pts' };

    return { winner: 'Tie / Shared', method: 'All tie-breakers equal' };
  }

  function fxCard(match, isKnockout, isBronze = false, matchLabel = null){
    const { hScore, aScore } = extractScores(match);
    const hasScore = hScore !== "" && hScore !== undefined && hScore !== null &&
                     aScore !== "" && aScore !== undefined && aScore !== null;

    let midHtml = '';
    let tieBreakNote = '';

    if (hasScore) {
      midHtml = `<span class="vs">${hScore}</span> <span style="color:var(--text-dim); margin: 0 4px;">-</span> <span class="vs">${aScore}</span>`;
      
      if (isKnockout && Number(hScore) === Number(aScore)) {
        const evaluation = evaluateKnockoutWinner(match);
        if (evaluation.winner) {
          tieBreakNote = `<div class="tie-break-info">⚖️ Tie-Breaker: <strong>${evaluation.method}</strong> ➔ Winner: <strong>${evaluation.winner}</strong></div>`;
        }
      }
    } else {
      midHtml = `<span class="vs" style="font-size: 14px; ${isBronze ? 'color:var(--bronze)':''}">VS</span>`;
    }
    
    const badgeHtml = matchLabel ? `<div class="match-badge">${matchLabel}</div>` : '';

    return `
      <div class="fx ${isKnockout ? 'knockout':''} ${isBronze ? 'bronze-fx':''}">
        ${badgeHtml}
        <div class="side home">
          <div class="tname">${match.home_team}</div>
        </div>
        <div class="mid" style="flex: 0 0 auto; min-width: 60px; white-space: nowrap; text-align: center;">
          ${midHtml}
        </div>
        <div class="side away">
          <div class="tname">${match.away_team || 'TBD'}</div>
        </div>
      </div>
      ${tieBreakNote}
    `;
  }

  function renderMatchView(stageId, title, subtitle, isKnockout, showMatchNumber = false, prefix = "M") {
    const matches = getMatches(stageId);
    if(matches.length === 0) {
      return `
        <div class="stagehead"><h2>${title}</h2><div class="stagesub">${subtitle}</div></div>
        <div style="text-align:center; padding: 40px; color: var(--text-dim); font-family:'JetBrains Mono', monospace;">No fixtures updated yet.</div>`;
    }
    return `
      <div class="stagehead">
        <h2>${title}</h2>
        <div class="stagesub">${subtitle}</div>
      </div>
      <div class="fixtures-grid">
        ${matches.map((m, i) => {
          const matchLabel = showMatchNumber ? `${prefix} ${i + 1}` : null;
          return fxCard(m, isKnockout, false, matchLabel);
        }).join("")}
      </div>
    `;
  }

  function renderFinalView(){
    const finalMatches = getMatches('final');
    const thirdMatches = getMatches('third');
    
    const fM = finalMatches[0] || null;
    const tM = thirdMatches[0] || null;

    let html = `
      <div class="stagehead">
        <h2>Final · Week 9</h2>
        <div class="stagesub">CHAMPIONSHIP DECIDER & 3RD PLACE</div>
      </div>
      <div class="finals-container">
    `;

    if (fM) {
      const { hScore, aScore } = extractScores(fM);
      const hasFScore = hScore !== "" && hScore !== undefined && hScore !== null && aScore !== "" && aScore !== undefined && aScore !== null;
      const displayH = hasFScore ? hScore : '-';
      const displayA = hasFScore ? aScore : '-';
      
      const evalFinal = evaluateKnockoutWinner(fM);
      const homeWin = hasFScore && (Number(hScore) > Number(aScore) || evalFinal.winner === fM.home_team);
      const awayWin = hasFScore && (Number(aScore) > Number(hScore) || evalFinal.winner === fM.away_team);

      html += `
        <section class="final-card-section grand-final">
          <div class="round-label">🏆 Grand Final</div>
          <div class="bmatch">
            <div class="brow ${homeWin ? 'winner' : ''}"><span class="bname">${fM.home_team}</span> <span class="bscore">${displayH}</span></div>
            <div class="brow ${awayWin ? 'winner' : ''}"><span class="bname">${fM.away_team}</span> <span class="bscore">${displayA}</span></div>
          </div>
          <div class="trophy-slot">
            <div class="cup">🏆</div>
            <div class="champ">CHAMPION — 60K</div>
          </div>
          <div style="margin-top:14px;">
            ${fxCard(fM, true, false)}
          </div>
        </section>
      `;
    }

    if (tM) {
      const { hScore, aScore } = extractScores(tM);
      const hasTScore = hScore !== "" && hScore !== undefined && hScore !== null && aScore !== "" && aScore !== undefined && aScore !== null;
      const displayH = hasTScore ? hScore : '-';
      const displayA = hasTScore ? aScore : '-';

      const evalThird = evaluateKnockoutWinner(tM);
      const homeWin = hasTScore && (Number(hScore) > Number(aScore) || evalThird.winner === tM.home_team);
      const awayWin = hasTScore && (Number(aScore) > Number(hScore) || evalThird.winner === tM.away_team);

      html += `
        <section class="final-card-section third-place">
          <div class="round-label bronze-label">🥉 3rd Place Play-off</div>
          <div class="bmatch">
            <div class="brow ${homeWin ? 'winner' : ''}"><span class="bname">${tM.home_team}</span> <span class="bscore">${displayH}</span></div>
            <div class="brow ${awayWin ? 'winner' : ''}"><span class="bname">${tM.away_team}</span> <span class="bscore">${displayA}</span></div>
          </div>
          <div class="trophy-slot">
            <div class="cup">🥉</div>
            <div class="champ bronze-champ">3RD PLACE — 20K</div>
          </div>
          <div style="margin-top:14px;">
            ${fxCard(tM, false, true)}
          </div>
        </section>
      `;
    }

    html += `</div>`;

    if (!fM && !tM) {
      html += `<div style="text-align:center; padding: 40px; color: var(--text-dim); font-family:'JetBrains Mono', monospace;">Final fixtures not updated yet.</div>`;
    }

    return html;
  }

  function renderPostersView() {
    return `
      <div class="stagehead">
        <h2>Teams Posters</h2>
        <div class="stagesub">24 TEAMS OFFICIAL CRESTS & LINEUP</div>
      </div>
      <div class="poster-container">
        <p style="color:var(--text-dim); font-family:'JetBrains Mono', monospace; font-size:13px; margin-bottom:16px;">TW FPL Super Chapter 1 Official 24 Teams Grid Poster</p>
        <img src="images/team-posters.png" alt="Teams Posters" class="poster-img">
      </div>
    `;
  }

  function renderRulesView() {
    return `
      <div class="stagehead">
        <h2>Tournament Rules & Plan</h2>
        <div class="stagesub">OFFICIAL GUIDELINES & PRIZE POOL</div>
      </div>
      <div class="poster-container">
        <p style="color:var(--text-dim); font-family:'JetBrains Mono', monospace; font-size:13px; margin-bottom:16px;">TW FPL Super Chapter 1 Rules & Tournament Info Infographic</p>
        <img src="images/tournament-rules.png" alt="Tournament Rules" class="poster-img">
      </div>
    `;
  }

  // Tab View Mapping
  const views = {
    standings: renderStandings,
    wk2: () => renderMatchView('wk2', "Week 2", "MATCH 1 · H TO H", false),
    wk3: () => renderMatchView('wk3', "Week 3", "MATCH 2 · H TO H", false),
    wk4: () => renderMatchView('wk4', "Week 4", "MATCH 3 · H TO H", false),
    wk5: () => renderMatchView('wk5', "Week 5", "MATCH 4 · H TO H", false),
    
    // Round of 16 (8 Matches) - Top 16 teams with M 1 to M 8 labels
    r16: () => renderMatchView('r16', "Round of 16", "TOP 16 KNOCKOUT (8 MATCHES)", true, true, "M"),
    
    qf: () => renderMatchView('qf', "Quarter-Final", "8 TEAMS (4 MATCHES)", true, true, "QM"),
    sf: () => renderMatchView('sf', "Semi-Final", "WEEK 8 · 4 TEAMS", true),
    final: renderFinalView,
    
    posters: renderPostersView,
    rules: renderRulesView
  };

  // Fixed Syntax Error: ensure space between function and setView name
  function setView(name) {
    mainContainer.innerHTML = views[name]();
    document.querySelectorAll('.tab').spaces = document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.view === name);
    });
  }

  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => setView(t.dataset.view));
  });

  setView('standings');
});
