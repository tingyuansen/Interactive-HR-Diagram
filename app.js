const stages = [
  {
    key: "Pre-Main Sequence",
    description: "Protostars contracting before stable hydrogen fusion.",
    color: "#88CCEE",
  },
  {
    key: "Main Sequence",
    description: "Stars stably fusing hydrogen in their cores.",
    color: "#44AA99",
  },
  {
    key: "Subgiant",
    description: "Hydrogen is exhausted; outer layers expand slightly.",
    color: "#117733",
  },
  {
    key: "Red Giant",
    description: "Outer layers balloon as shell burning dominates.",
    color: "#DDCC77",
  },
  {
    key: "Horizontal Branch",
    description: "Helium fusion stabilizes the core again.",
    color: "#CC6677",
  },
  {
    key: "White Dwarf",
    description: "Degenerate remnant cooling over billions of years.",
    color: "#AA4499",
  },
];

const masses = [0.5, 1.0, 2.0, 5.0, 15.0];

const rng = d3.randomLcg(0.42);
const stageColor = stages.reduce((colors, stage) => {
  colors[stage.key] = stage.color;
  return colors;
}, {});

function clip(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function buildCatalog(numMainSequence = 600) {
  const data = [];

  const normal = (mean, sd) => d3.randomNormal.source(() => rng())(mean, sd);
  const uniform = (min, max) => d3.randomUniform.source(() => rng())(min, max);
  const logNormal = (mu, sigma) => d3.randomLogNormal.source(() => rng())(mu, sigma);

  for (let i = 0; i < numMainSequence; i++) {
    const temp = clip(normal(5800, 1600)(), 3000, 15000);
    const mass = clip(Math.pow(temp / 5800, 1.5), 0.1, 25);
    const lum = clip(Math.pow(mass, 3.5) + normal(0, 0.3)(), 0.01, Math.pow(10, 4.2));
    data.push({
      id: i,
      stage: "Main Sequence",
      temperature: temp,
      luminosity: lum,
      mass,
      age: uniform(100, 9000)(),
      metallicity: clip(normal(0, 0.2)(), -1.5, 0.5),
    });
  }

  const addStage = (count, stageKey, tempMean, tempSigma, lumMean, lumSigma, massBounds, ageBounds) => {
    for (let i = 0; i < count; i++) {
      data.push({
        id: `s-${stageKey}-${i}`,
        stage: stageKey,
        temperature: clip(normal(tempMean, tempSigma)(), 2500, 40000),
        luminosity: clip(logNormal(Math.log(lumMean), lumSigma)(), 0.0001, Math.pow(10, 4.5)),
        mass: uniform(...massBounds)(),
        age: uniform(...ageBounds)(),
        metallicity: clip(normal(-0.1, 0.3)(), -1.5, 0.5),
      });
    }
  };

  addStage(120, "Pre-Main Sequence", 4500, 800, 3.5, 0.6, [0.2, 2.5], [1, 50]);
  addStage(90, "Subgiant", 5200, 700, 20, 0.5, [0.8, 2.5], [900, 5000]);
  addStage(110, "Red Giant", 4000, 500, 200, 0.6, [0.8, 8], [1000, 9000]);
  addStage(75, "Horizontal Branch", 6000, 900, 60, 0.3, [0.6, 2], [2500, 12000]);
  addStage(80, "White Dwarf", 13000, 2500, 0.03, 0.4, [0.45, 1.2], [3000, 12000]);

  return data;
}

document.addEventListener('DOMContentLoaded', () => {
  const catalog = buildCatalog();

  const stageFilters = document.getElementById('stage-filters');
  const highlightSelect = document.getElementById('highlight-stage');

  if (!stageFilters || !highlightSelect) {
    console.error('Missing UI elements for stage controls.');
    return;
  }

  let filtered = [];

  stages.forEach(stage => {
    const chip = document.createElement('label');
    chip.className = 'chip active';
    chip.dataset.key = stage.key;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.dataset.key = stage.key;
    checkbox.addEventListener('change', () => {
      chip.classList.toggle('active', checkbox.checked);
      filtered = filterCatalog();
      buildHRDiagram(filtered);
      downloadCSV(filtered);
      updateCallout(highlightSelect.value);
    });

    const labelText = document.createElement('span');
    labelText.textContent = stage.key;

    chip.appendChild(checkbox);
    chip.appendChild(labelText);
    stageFilters.appendChild(chip);

    const option = document.createElement('option');
    option.value = stage.key;
    option.textContent = stage.key;
    highlightSelect.appendChild(option);
  });

  const legend = document.getElementById('legend');
  stages.forEach(stage => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<span class="legend-swatch" style="background:${stage.color}"></span>${stage.key}`;
    legend.appendChild(item);
  });

  const tooltip = document.getElementById('tooltip');
  if (!tooltip) {
    console.error('Tooltip element missing.');
    return;
  }

  function buildHRDiagram(data) {
    const container = d3.select('#hr-plot');
    container.selectAll('*').remove();

    const width = container.node().clientWidth || 800;
    const height = Math.max(width / 1.35, 420);
    container.style('height', `${height}px`);

    const svg = container.append('svg')
      .attr('width', width)
      .attr('height', height);

    const margin = { top: 35, right: 30, bottom: 60, left: 75 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain([40000, 2500])
      .range([0, innerWidth]);

    const y = d3.scaleLog()
      .domain([Math.pow(10, -4), Math.pow(10, 4.5)])
      .range([innerHeight, 0]);

    const xAxis = d3.axisBottom(x)
      .tickFormat(d => `${d / 1000}K`)
      .ticks(5);

    const yAxis = d3.axisLeft(y)
      .ticks(6, d3.format('.0f'));

    const grid = g.append('g');
    const gridHorizontal = grid.append('g').attr('class', 'grid-horizontal');
    const gridVertical = grid.append('g').attr('class', 'grid-vertical');

    const styleAxis = (selection) => {
      selection.selectAll('text').attr('fill', '#5a5b72');
      selection.selectAll('path, line').attr('stroke', 'rgba(0,0,0,0.2)');
    };

    const xAxisGroup = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);
    styleAxis(xAxisGroup);

    const yAxisGroup = g.append('g')
      .call(yAxis);
    styleAxis(yAxisGroup);

    svg.append('text')
      .attr('x', margin.left + innerWidth / 2)
      .attr('y', height - 15)
      .attr('text-anchor', 'middle')
      .attr('fill', '#4f5070')
      .attr('font-size', 12)
      .text('Surface Temperature (K)');

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 18)
      .attr('x', -height / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#4f5070')
      .attr('font-size', 12)
      .text('Luminosity (log scale) [L☉]');

    const radiusScale = d3.scaleSqrt()
      .domain(d3.extent(data, d => d.mass))
      .range([4, 16]);

    const points = g.append('g')
      .selectAll('circle')
      .data(data, d => d.id)
      .join('circle')
      .attr('cx', d => x(d.temperature))
      .attr('cy', d => y(d.luminosity))
      .attr('r', d => radiusScale(d.mass))
      .attr('fill', d => stages.find(s => s.key === d.stage)?.color || '#888')
      .attr('fill-opacity', 0.75)
      .attr('stroke', 'rgba(255,255,255,0.8)')
      .attr('stroke-width', 1.1)
      .style('mix-blend-mode', 'multiply')
      .on('mousemove', (event, d) => {
        tooltip.innerHTML = `
          <strong>${d.stage}</strong><br>
          T = ${d.temperature.toFixed(0)} K<br>
          L = ${d.luminosity.toFixed(2)} L☉<br>
          Mass = ${d.mass.toFixed(2)} M☉<br>
          Age ≈ ${d.age.toFixed(0)} Myr
        `;
        tooltip.style.left = `${event.pageX}px`;
        tooltip.style.top = `${event.pageY}px`;
        tooltip.classList.add('visible');
      })
      .on('mouseleave', () => {
        tooltip.classList.remove('visible');
      });

    const renderGrid = (scaleX, scaleY) => {
      const horizontalTicks = scaleY.ticks(8).filter((tick) => tick > 0);
      gridHorizontal.selectAll('line')
        .data(horizontalTicks)
        .join('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', (d) => scaleY(d))
        .attr('y2', (d) => scaleY(d))
        .attr('stroke', 'rgba(0,0,0,0.05)');

      const verticalTicks = scaleX.ticks(8);
      gridVertical.selectAll('line')
        .data(verticalTicks)
        .join('line')
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('x1', (d) => scaleX(d))
        .attr('x2', (d) => scaleX(d))
        .attr('stroke', 'rgba(0,0,0,0.04)');
    };

    renderGrid(x, y);

    const zoom = d3.zoom()
      .scaleExtent([0.7, 40])
      .translateExtent([[0, 0], [innerWidth, innerHeight]])
      .extent([[0, 0], [innerWidth, innerHeight]])
      .on('zoom', (event) => {
        const zx = event.transform.rescaleX(x);
        const zy = event.transform.rescaleY(y);

        xAxisGroup.call(xAxis.scale(zx));
        styleAxis(xAxisGroup);
        yAxisGroup.call(yAxis.scale(zy));
        styleAxis(yAxisGroup);

        renderGrid(zx, zy);

        points
          .attr('cx', (d) => zx(d.temperature))
          .attr('cy', (d) => zy(d.luminosity));
      });

    svg.call(zoom);

    return svg.node();
  }

  function filterCatalog() {
    const activeStages = Array.from(stageFilters.querySelectorAll('input:checked')).map(
      (input) => input.dataset.key,
    );
    const tempMax = +document.getElementById('temp-range').value;
    const lumMax = +document.getElementById('lum-range').value;
    const massMax = +document.getElementById('mass-range').value;

    document.getElementById('temp-value').textContent = tempMax;
    document.getElementById('lum-value').textContent = lumMax.toFixed(1);
    document.getElementById('mass-value').textContent = massMax.toFixed(1);

    return catalog.filter(
      (d) =>
        activeStages.includes(d.stage) &&
        d.temperature <= tempMax &&
        Math.log10(d.luminosity) <= lumMax &&
        d.mass <= massMax,
    );
  }

  function updateCallout(stageKey) {
    const stage = stages.find((s) => s.key === stageKey) || stages[0];
    const callout = document.getElementById('stage-callout');
    callout.innerHTML = `
      <h3 style="color:${stage.color}">${stage.key}</h3>
      <p style="color:var(--muted)">${stage.description}</p>
    `;
    callout.style.borderColor = stage.color + '33';
  }

  function downloadCSV(data) {
    const header = ['stage', 'temperature', 'luminosity', 'mass', 'age', 'metallicity'];
    const rows = data.map((d) => header.map((h) => d[h]));
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.getElementById('download-btn');
    link.href = url;
  }

  const setHighlightStage = (stageKey) => {
    highlightSelect.value = stageKey;
    updateCallout(stageKey);
  };

  filtered = filterCatalog();
  buildHRDiagram(filtered);
  downloadCSV(filtered);

  stageFilters.addEventListener('click', (event) => {
    if (event.target.tagName === 'INPUT') {
      event.stopPropagation();
      return;
    }
    const label = event.target.closest('label');
    if (!label) return;
    event.preventDefault();
    const checkbox = label.querySelector('input[type="checkbox"]');
    checkbox.checked = !checkbox.checked;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  });

  highlightSelect.addEventListener('change', (event) => {
    setHighlightStage(event.target.value);
  });

  ['temp-range', 'lum-range', 'mass-range'].forEach((id) => {
    document.getElementById(id).addEventListener('input', () => {
      filtered = filterCatalog();
      buildHRDiagram(filtered);
      downloadCSV(filtered);
    });
  });

  function computeEvolutionTrack(mass, points = 120) {
    const age = d3.range(points).map((i) => 0.01 + (13000 - 0.01) * (i / (points - 1)));
    const tMs = 10000 * Math.pow(mass, -2.5);
    const tRed = tMs * 0.1;
    const tWhite = 13000 - tMs - tRed;

    return age.map((a) => {
      let temperature, luminosity, stage;
      if (a <= tMs) {
        const ratio = a / tMs;
        temperature = (1.1 - 0.15 * ratio) * 5800 * Math.pow(mass, 0.08);
        luminosity = Math.pow(mass, 3.5) * (0.9 + 0.2 * ratio);
        stage = 'Main Sequence';
      } else if (a <= tMs + tRed) {
        const ratio = (a - tMs) / tRed;
        temperature = 5800 * Math.pow(mass, -0.2) * (0.45 + 0.05 * Math.sin(ratio * Math.PI));
        luminosity = Math.pow(mass, 2.2) * (40 + 400 * ratio);
        stage = 'Red Giant';
      } else {
        const ratio = Math.min((a - tMs - tRed) / Math.max(tWhite, 1e-3), 1);
        temperature = 15000 * (1 - 0.7 * ratio) * Math.pow(mass, -0.1);
        luminosity = 0.05 * (1 - 0.3 * ratio);
        stage = 'White Dwarf';
      }
      return { age: a, temperature, luminosity, stage, mass };
    });
  }

  const trackControls = document.getElementById('track-controls');
  const trackMassSelect = document.getElementById('track-mass');

  if (!trackControls || !trackMassSelect) {
    console.error('Missing elements for track controls.');
    return;
  }

  masses.forEach((mass) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'track-toggle active';
    button.dataset.mass = mass;
    button.textContent = `${mass.toFixed(1)} M☉`;
    trackControls.appendChild(button);

    const option = document.createElement('option');
    option.value = mass;
    option.textContent = `${mass.toFixed(1)} M☉`;
    trackMassSelect.appendChild(option);
  });

  const getActiveTrackMasses = () => {
    const active = Array.from(trackControls.querySelectorAll('.track-toggle.active')).map((btn) => +btn.dataset.mass);
    return active.length ? active : [...masses];
  };

  function refreshTracks() {
    const activeMasses = getActiveTrackMasses();
    buildTracksPlot(activeMasses);
    populateLifetimeTable(activeMasses);
  }

  function buildTracksPlot(selectedMasses) {
    const container = d3.select('#tracks-plot');
    container.selectAll('*').remove();

    const width = container.node().clientWidth || 800;
    const height = Math.max(width / 1.5, 380);
    container.style('height', `${height}px`);

    const svg = container.append('svg')
      .attr('width', width)
      .attr('height', height);

    const margin = { top: 20, right: 30, bottom: 40, left: 70 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const plotRoot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([40000, 2500]).range([0, innerWidth]);
    const y = d3.scaleLog().domain([Math.pow(10, -4), Math.pow(10, 4)]).range([innerHeight, 0]);

    const xAxis = d3.axisBottom(x).ticks(5);
    const yAxis = d3.axisLeft(y).ticks(5, d3.format('.0f'));

    const styleAxis = (selection) => {
      selection.selectAll('text').attr('fill', '#5a5b72');
      selection.selectAll('path, line').attr('stroke', 'rgba(0,0,0,0.2)');
    };

    const xAxisGroup = plotRoot.append('g').attr('transform', `translate(0,${innerHeight})`).call(xAxis);
    styleAxis(xAxisGroup);
    const yAxisGroup = plotRoot.append('g').call(yAxis);
    styleAxis(yAxisGroup);

    const trackLayer = plotRoot.append('g');

    const trackData = selectedMasses.map((mass) => ({
      mass,
      id: `mass-${String(mass).replace(/\./g, '-')}`,
      data: computeEvolutionTrack(mass),
    }));

    const tracks = trackLayer.selectAll('g.track')
      .data(trackData, (d) => d.id)
      .join((enter) => {
        const group = enter.append('g').attr('class', (d) => `track ${d.id}`);
        group.append('path').attr('class', 'track-line');
        group.append('g').attr('class', 'track-points');
        return group;
      });

    const updateTracks = (scaleX, scaleY) => {
      const lineGen = d3.line()
        .x((d) => scaleX(d.temperature))
        .y((d) => scaleY(d.luminosity))
        .curve(d3.curveCatmullRom.alpha(0.6));

      tracks.select('path.track-line')
        .attr('fill', 'none')
        .attr('stroke', stageColor['Main Sequence'] || '#44AA99')
        .attr('stroke-width', 2.5)
        .attr('opacity', 0.4)
        .attr('d', (d) => lineGen(d.data));

      tracks.select('g.track-points').each(function (d) {
        d3.select(this)
          .selectAll('circle')
          .data(d.data.filter((_, i) => i % 6 === 0))
          .join('circle')
          .attr('r', 3.6)
          .attr('fill', (p) => stageColor[p.stage] || '#777')
          .attr('stroke', 'white')
          .attr('stroke-width', 1.5)
          .style('mix-blend-mode', 'multiply')
          .attr('cx', (p) => scaleX(p.temperature))
          .attr('cy', (p) => scaleY(p.luminosity))
          .on('mousemove', (event, p) => {
            tooltip.innerHTML = `
              <strong>${d.mass.toFixed(1)} M☉</strong><br>
              ${p.stage}<br>
              Age: ${p.age.toFixed(0)} Myr<br>
              T = ${p.temperature.toFixed(0)} K<br>
              L = ${p.luminosity.toFixed(2)} L☉
            `;
            tooltip.style.left = `${event.pageX}px`;
            tooltip.style.top = `${event.pageY}px`;
            tooltip.classList.add('visible');
          })
          .on('mouseleave', () => {
            tooltip.classList.remove('visible');
          });
      });
    };

    updateTracks(x, y);

    const zoom = d3.zoom()
      .scaleExtent([0.7, 35])
      .translateExtent([[0, 0], [innerWidth, innerHeight]])
      .extent([[0, 0], [innerWidth, innerHeight]])
      .on('zoom', (event) => {
        const zx = event.transform.rescaleX(x);
        const zy = event.transform.rescaleY(y);
        if (!zx || !zy) {
          console.warn('Zoom transform returned invalid scales');
          return;
        }
        xAxisGroup.call(xAxis.scale(zx));
        styleAxis(xAxisGroup);
        yAxisGroup.call(yAxis.scale(zy));
        styleAxis(yAxisGroup);
        updateTracks(zx, zy);
      });

    svg.call(zoom);
  }

  refreshTracks();

  function stageDurations(mass) {
    const mainSequence = 10000 * Math.pow(mass, -2.5);
    const redGiant = mainSequence * 0.1;
    const whiteDwarf = Math.max(13000 - mainSequence - redGiant, 500);
    return {
      mass,
      preMain: 10 + Math.pow(mass, -1.3) * 5,
      mainSequence,
      redGiant,
      whiteDwarf,
    };
  }

  function populateLifetimeTable(selectedMasses) {
    const tbody = document.getElementById('lifetime-table');
    tbody.innerHTML = '';
    selectedMasses.forEach((mass) => {
      const row = document.createElement('tr');
      const durations = stageDurations(mass);
      row.innerHTML = `
        <td>${mass.toFixed(1)}</td>
        <td>${durations.preMain.toFixed(0)}</td>
        <td>${durations.mainSequence.toFixed(0)}</td>
        <td>${durations.redGiant.toFixed(0)}</td>
        <td>${durations.whiteDwarf.toFixed(0)}</td>
      `;
      tbody.appendChild(row);
    });
  }

  const ageSlider = document.getElementById('age-slider');
  const metrics = document.getElementById('track-metrics');

  if (!ageSlider || !metrics) {
    console.error('Missing elements for lifetime explorer.');
    return;
  }

  function updateLifetimeExplorer() {
    const mass = +trackMassSelect.value;
    const track = computeEvolutionTrack(mass);
    const age = +ageSlider.value;
    const closest = track.reduce((prev, curr) =>
      Math.abs(curr.age - age) < Math.abs(prev.age - age) ? curr : prev,
    );

    metrics.innerHTML = `
      <div class="metric">
        <strong>Stage</strong>
        <span>${closest.stage}</span>
      </div>
      <div class="metric">
        <strong>Temperature (K)</strong>
        <span>${closest.temperature.toFixed(0)}</span>
      </div>
      <div class="metric">
        <strong>Luminosity (L☉)</strong>
        <span>${closest.luminosity.toFixed(2)}</span>
      </div>
      <div class="metric">
        <strong>Mass (M☉)</strong>
        <span>${mass.toFixed(1)}</span>
      </div>
      <div class="metric">
        <strong>Age (Myr)</strong>
        <span>${closest.age.toFixed(0)}</span>
      </div>
    `;
  }

  trackMassSelect.addEventListener('change', () => {
    updateLifetimeExplorer();
  });

  ageSlider.addEventListener('input', () => {
    updateLifetimeExplorer();
  });

  updateLifetimeExplorer();

  const glossaryEntries = {
    'Spectral Type': 'Classification of stars by temperature and spectral lines (OBAFGKM).',
    Luminosity: "Total energy output per unit time compared to the Sun.",
    Metallicity: "Fraction of a star's mass made of elements heavier than helium.",
    Isochrone: 'Curve connecting stars of equal age on the HR diagram.',
    'Main Sequence Turnoff': 'Temperature where stars leave the main sequence, revealing age.',
    'Hertzsprung–Russell Diagram': 'Plot of stellar luminosity versus temperature showcasing evolution.',
    'Helium Flash': 'Rapid ignition of helium in the cores of low-mass stars on the red giant branch.',
    'Planetary Nebula': 'Glowing shell of ionized gas ejected by asymptotic giant branch stars.',
  };

  const glossary = document.getElementById('glossary');
  Object.entries(glossaryEntries).forEach(([term, definition]) => {
    const item = document.createElement('div');
    item.className = 'glossary-item';
    item.innerHTML = `<strong>${term}:</strong> <span style="color:var(--muted)">${definition}</span>`;
    glossary.appendChild(item);
  });

  const tabs = document.querySelectorAll('.tab-button');
  tabs.forEach((button) => {
    button.addEventListener('click', () => {
      tabs.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
      document.querySelectorAll('.tab-content').forEach((content) => (content.hidden = true));
      const targetPanel = document.getElementById(`tab-${button.dataset.tab}`);
      if (targetPanel) {
        targetPanel.hidden = false;
        if (button.dataset.tab === 'tracks') {
          refreshTracks();
        } else if (button.dataset.tab === 'lifetime') {
          updateLifetimeExplorer();
        }
      }
    });
  });

  window.addEventListener('resize', () => {
    buildHRDiagram(filtered);
    refreshTracks();
  });

  trackControls.addEventListener('click', (event) => {
    const toggle = event.target.closest('.track-toggle');
    if (!toggle) return;
    toggle.classList.toggle('active');
    refreshTracks();
  });

  trackControls.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      const toggle = event.target.closest('.track-toggle');
      if (!toggle) return;
      event.preventDefault();
      toggle.classList.toggle('active');
      refreshTracks();
    }
  });
});


