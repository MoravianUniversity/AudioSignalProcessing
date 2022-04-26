/**
 * Utilities for Fourier transform demos. 
 * Author: Jeffrey Bush
 */

/**
 * Compute the sum of cosines of the given frequencies and amplitudes. The
 * computation is done over the given number of seconds and evaluated at
 * the given number of data points (n).
 */
function computeCosines(n, secs, freqs, amps) {
  let array = new Float64Array(n);
  const factor = 2*Math.PI*secs/n;
  const amp_factor = 1/amps.reduce((p, c) => p + c, 0);
  for (let i = 0; i < freqs.length; i++) {
    let f = freqs[i]*factor;
    for (let x = 0; x < n; x++) {
      array[x] += amp_factor*amps[i]*Math.cos(f*x);
    }
  }
  return array;
}

/**
 * Clear the canvas (draw a black rectangle over everything).
 */
function clearCanvas(context, style) {
  if (typeof style === "undefined") { style = 'black'; }
  context.fillStyle = style;
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
}

/**
 * Clear a curve on the canvas.
 */
function drawCurve(context, data, stride, scale) {
  if (typeof stride === "undefined") { stride = 1; }
  if (typeof scale === "undefined") { scale = 1; }

  const height = context.canvas.height;
  context.beginPath();
  for (let i = 0, x = 0; i < data.length; x++, i += stride) {
    let y = (1 - data[Math.round(i)] * scale) * height/2
    if (i === 0) { context.moveTo(x, y); }
    else { context.lineTo(x, y); }
  }
  context.stroke();
}

/**
 * Draws a grid on a the canvas with vertical lines at all of the given indices
 * and a horizontal line in the middle.
 */
function drawGrid(context, indices, labels) {
  const width = context.canvas.width, height = context.canvas.height;
  context.font = '0.75em sans-serif';
  context.strokeStyle = 'lightgray';
  context.fillStyle = 'lightgray';
  context.lineWidth = 1;
  context.setLineDash([8, 4]);
  for (let i = 0; i < indices.length; i++) {
    let x = indices[i];
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
    if (labels && labels[i]) {
      const text = labels[i], metrics = context.measureText(text);
      context.fillText(text, x - metrics.width - 4, height - 3);
    }
  }
  context.beginPath();
  context.moveTo(0, height/2);
  context.lineTo(width, height/2);
  context.stroke();
  context.setLineDash([]);
}

/**
 * Draws the data along with putting dashed lines at each of the second
 * marks. Some of the data will be skipped to fit onto the canvas.
 */
function drawWaveform(context, data, secs, total_seconds) {
  if (typeof total_seconds === "undefined") { total_seconds = secs; }

  const width = context.canvas.width, height = context.canvas.height;
  const stride = data.length/width*total_seconds/secs;

  // draw the grid
  clearCanvas(context);
  let indices = [], labels = [];
  for (let i = 1; i < total_seconds; i++) {
    indices.push(Math.round(i*width/total_seconds));
    labels.push(i + " sec");
  }
  drawGrid(context, indices, labels);

  // draw the wave
  context.strokeStyle = 'lime';
  context.lineWidth = 2;
  drawCurve(context, data, stride);
}

/**
 * Draws the winding of a data series across the given number of cycles.
 */
function drawWinding(context, data, cycles, amp_scale) {
  if (typeof amp_scale === "undefined") { amp_scale = 1; }

  const width = context.canvas.width, height = context.canvas.height;
  const min = Math.min(height, width), scale = min/2;
  clearCanvas(context);
  context.scale(scale, scale);
  context.translate(1, 1);

  // x axis
  context.strokeStyle = 'lightgray';
  context.lineWidth = 1/scale;
  context.setLineDash([8/scale, 4/scale]);
  context.beginPath();
  context.moveTo(-1, 0);
  context.lineTo(1, 0);
  context.stroke();

  // y axis
  context.beginPath();
  context.moveTo(0, -1);
  context.lineTo(0, 1);
  context.stroke();
  context.setLineDash([]);

  // winding
  context.strokeStyle = 'lime';
  context.lineWidth = 2/scale;
  let xs = [], ys = [], x_sum = 0, y_sum = 0;
  const f = 2*Math.PI/cycles;
  for (let i = 0; i < data.length; i++) {
    let x = data[i]*Math.cos(i*f);
    let y = -data[i]*Math.sin(i*f);
    x_sum += x; y_sum += y;
    xs.push(x); ys.push(y);
  }
  context.beginPath();
  context.moveTo(xs[0], ys[0]);
  for (let i = 1; i < data.length; i++) { context.lineTo(xs[i], ys[i]); }
  context.stroke();

  // center of mass
  context.fillStyle = 'red';
  x_sum /= data.length;
  y_sum /= data.length;
  context.beginPath();
  context.ellipse(x_sum, y_sum, 4/scale, 4/scale, 0, 0, 2*Math.PI);
  context.fill();

  // text
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.font = 'bold 1em sans-serif';
  const text = `${(x_sum*amp_scale).toFixed(2)}, ${(y_sum*amp_scale).toFixed(2)}`;
  const metrics = context.measureText(text);
  context.fillText(text, min - metrics.width - 4, min - 4);
}

function drawFourier(context, data, seconds) {
  const n = data.length, n2 = context.canvas.width /*Math.floor(n/2)*/, resolution = seconds / n2;
  const freq_factor = 2*Math.PI*seconds*resolution/n;
  let reals = new Float64Array(n2 + 1);
  let imags = new Float64Array(n2 + 1);
  let mags = new Float64Array(n2 + 1);
  // let phases = new Float64Array(n2 + 1);
  let max = 0;
  for (let j = 0; j <= n2; j++) {
    let x_sum = 0, y_sum = 0;
    const f = j * freq_factor;
    for (let i = 0; i < n; i++) {
      x_sum += data[i]*Math.cos(i*f);
      y_sum -= data[i]*Math.sin(i*f);
    }
    reals[j] = x_sum / n;
    imags[j] = y_sum / n;
    mags[j] = Math.sqrt(reals[j] * reals[j] + imags[j] * imags[j]);
    // phases[j] = Math.atan2(imags[j], reals[j]);
    if (mags[j] > max) { max = mags[j]; }
  }

  const width = context.canvas.width, stride = reals.length/width;
  clearCanvas(context);

  let indices = [], labels = [];
  for (let i = 1; i < n2*resolution; i++) {
    indices.push(Math.round(i/resolution*width/(n2+1)));
    labels.push(i + " Hz");
  }
  drawGrid(context, indices, labels);
  
  context.lineWidth = 2;
  context.strokeStyle = '#FF8888';
  drawCurve(context, reals, stride, 1/max);
  context.strokeStyle = '#8888FF';
  drawCurve(context, imags, stride, 1/max);
  context.strokeStyle = 'white';
  drawCurve(context, mags, stride, 1/max);
  // context.strokeStyle = 'gray';
  // drawCurve(context, phases, stride, 1/(2*Math.PI));
}

/**
 * Draws an arrow from x0, y0 to x1, y1.
 */
function drawArrow(context, x0, y0, x1, y1) {
  const width = 3;
  const head_len = Math.min(0.2*Math.sqrt((x1-x0)*(x1-x0) + (y1-y0)*(y1-y0)), 5);
  const head_angle = Math.PI / 6;
  const angle = Math.atan2(y1 - y0, x1 - x0);

  context.lineWidth = width;

  /* Adjust the point */
  x1 -= width * Math.cos(angle);
  y1 -= width * Math.sin(angle);

  context.beginPath();
  context.moveTo(x0, y0);
  context.lineTo(x1, y1);
  context.stroke();

  context.beginPath();
  context.lineTo(x1, y1);
  context.lineTo(x1 - head_len * Math.cos(angle - head_angle), y1 - head_len * Math.sin(angle - head_angle));
  context.lineTo(x1 - head_len * Math.cos(angle + head_angle), y1 - head_len * Math.sin(angle + head_angle));
  context.closePath();
  context.stroke();
  context.fill();
}

/**
 * Adjusts the volume bars so they sum to 100. The event is an InputEvent which
 * may be for a volume input currently changing. The base name is the start of
 * the id's for volume inputs. The number of waves is the number of inputs to
 * look for (starting at 0, not including num_waves).
 */
function adjustVolumes(event, base_name, num_waves) {
  if (!event || !event.target.id.startsWith(base_name)) { return; }
  let elems = []
  for (let i = 0; i < num_waves; i++) {
    elems.push(document.getElementById(base_name+i));
  }
  let idx = +event.target.id.slice(base_name.length);
  let val = +elems[idx].value, sum = 0;
  for (let i = 0; i < num_waves; i++) { if (i !== idx) { sum += +elems[i].value; } }
  let factor = (100 - val) / sum;
  for (let i = 0; i < num_waves; i++) { if (i !== idx) { elems[i].value *= factor; } }
}
