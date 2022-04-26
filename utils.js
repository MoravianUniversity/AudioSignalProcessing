/**
 * Utilities for Fourier transform demos. 
 * Author: Jeffrey Bush
 */


function audioBufferLoader(context, url, onLoadFn, onErrorFn) {
  let onLoadCallback = onLoadFn || function(buffer){};
  let onErrorCallback = onErrorFn || function(){};
  let request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.responseType = 'arraybuffer';
  request.onload = function() {
    context.decodeAudioData(request.response, onLoadCallback, onErrorCallback)
  }
  request.send();
}

/**
 * Compute the sum of cosines of the given frequencies and amplitudes. The
 * computation is done over the given number of seconds and evaluated at
 * the given number of data points (n).
 */
function computeCosines(n, secs, freqs, amps) {
  let array = new Float32Array(n);
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
function drawCurve(context, data, stride, scale, x_inc) {
  const width = context.canvas.width, height = context.canvas.height;

  if (typeof stride === "undefined") { stride = 1; }
  if (typeof scale === "undefined") { scale = 1; }
  if (!x_inc) { x_inc = stride / data.length * width; }
  if (scale === 'auto') {
    let max = data.reduce((prev, x) => (prev > x) ? prev : x, 0);
    let min = data.reduce((prev, x) => (prev < x) ? prev : x, 0);
    scale = 0.95/Math.max(max, Math.abs(min));
  }

  context.beginPath();
  for (let i = 0, x = 0; i < data.length; x+=x_inc, i += stride) {
    let val = data[Math.round(i)];
    let y = (1 - val * scale) * height/2
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
      x = x - metrics.width < 0 - 4 ? x + 4 : x - metrics.width - 4;
      context.fillText(text, x, height - 3);
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
function drawWaveform(context, data, secs, total_seconds, indices, labels) {
  let provided_total_seconds = (typeof total_seconds !== "undefined") && secs !== total_seconds;
  if (!provided_total_seconds) { total_seconds = secs; }

  const width = context.canvas.width, height = context.canvas.height;
  const stride = provided_total_seconds ? data.length/width*total_seconds/secs : 1;

  // draw the grid
  clearCanvas(context);
  if (typeof indices === "undefined") {
    indices = [], labels = [];
    for (let i = 0; i <= total_seconds; i++) {
      indices.push(Math.round(i*width/total_seconds));
      labels.push(i + " sec");
    }
  }
  drawGrid(context, indices, labels);

  // draw the wave
  context.strokeStyle = 'lime';
  context.lineWidth = 2;
  drawCurve(context, data, stride, 'auto', provided_total_seconds ? 1 : 0);
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

function drawFourier(context, data, seconds, max_freq) {
  const width = context.canvas.width, height = context.canvas.height, n = data.length;
  max_freq = (typeof max_freq === "undefined") ? seconds : max_freq; // TODO: default isn't right...

  let reals, imags;
  if (pulse !== null) {
    // use PulseFFT if available
    // TODO: results in a bunch of nans, if I do it outside this function is seems to work...
    //data = extract(data, data.length/(max_freq*seconds*2)); // to match the spacing we need to pre-decimate the signal to match the max frequency
    [reals, imags] = fft(data);
  } else {
    [reals, imags] = fft_basic(data, seconds*max_freq, width);
  }
  reals[0] = 0;
  imags[0] = 0;
  //for (let j = 0; j < reals.length; j++) { reals[j] /= n; imags[j] /= n; }

  let mags = new Float32Array(reals.length);
  // let phases = new Float32Array(reals.length);
  let max = 0;
  for (let j = 0; j < reals.length; j++) {
    mags[j] = Math.sqrt(reals[j] * reals[j] + imags[j] * imags[j]);
    // phases[j] = Math.atan2(imags[j], reals[j]);
    if (mags[j] > max) { max = mags[j]; }
  }
  max *= 1.05;


  // do the actual drawing

  clearCanvas(context);

  let indices = [], labels = [];
  if (max_freq > 1000) {
    // for (let i = 0; i <= max_freq; i += 500) {
    //  indices.push(Math.round(i*width/max_freq));
    //  labels.push((i/1000).toFixed(1) + " kHz");
    // }
    // freqs = [32.70320, 55, 82.40689, 110,
    //          130.8128, 164.8138, 195.9977, 220, //246.9417,
    //          261.6256, 293.6648, 311.1270, 329.6276, 349.2282, 369.9944, 391.9954, 415.3047, 440, 466.1638, 493.8833,
    //          523.2511, 554.3653, 587.3295, 622.2540, 659.2551, 698.4565, 739.9888, 783.9909, 830.6094, 880, 932.3275, 987.7666,
    //          1046.502, 1318.510, 1760];
    // labels = ['C₁', 'A₁', 'E₂', 'A₂',
    //           'C₃', 'E₃', 'G₃', 'A₃', //'B₃',
    //           'C₄', 'D₄', '', 'E₄', 'F₄', '', 'G₄', 'A♭₄', 'A₄', 'B♭₄', 'B₄',
    //           'C₅', 'C♯₅', 'D₅', 'E♭₅', 'E₅', 'F₅', 'F♯₅', 'G₅', 'A♭₅', 'A₅', 'B♭₅', 'B₅',
    //           'C₆', 'E₆', 'A₆'];
    freqs = [55, 110,
             164.8138, 220,
             261.6256, 329.6276, 391.9954, 440,
             523.2511, 587.3295, 659.2551, 698.4565, 783.9909, 880, 932.3275, 987.7666,
             1046.502, 1108.731, 1174.659, 1244.508, 1318.510, 1396.913, 1479.978, 1567.982, 1661.219, 1760, 1864.655, 1975.533,
             2093.005];
    labels = ['A', 'A',  // 1, 2
              'E', 'A',  // 3
              'C', 'E', 'G', 'A',  // 4
              'C', 'D', 'E', 'F', 'G', 'A', 'B♭', 'B',  // 5
              'C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B',  // 6
              'C'];  // 7
    indices = freqs.map((x) => Math.round(x*width/max_freq));
    let mid_c = 261.6256*width/max_freq;
    context.fillStyle = '#440000';
    context.fillRect(mid_c-15, height-15, 15, 15);
  } else {
    for (let i = 0; i <= max_freq; i++) {
      indices.push(Math.round(i*width/max_freq));
      labels.push(i + " Hz");
    }
  }
  drawGrid(context, indices, labels);
  
  context.lineWidth = 2;
  context.strokeStyle = '#FF8888';1
  drawCurve(context, reals, 1, 1/max);
  context.strokeStyle = '#8888FF';
  drawCurve(context, imags, 1, 1/max);
  context.strokeStyle = 'white';
  drawCurve(context, mags, 1, 1/max);
  // context.strokeStyle = 'gray';
  // drawCurve(context, phases, 1, 1/(2*Math.PI));
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
  let elems = [];
  for (let i = 0; i < num_waves; i++) {
    elems.push(document.getElementById(base_name+i));
  }
  let idx = +event.target.id.slice(base_name.length);
  let val = +elems[idx].value, sum = 0;
  for (let i = 0; i < num_waves; i++) { if (i !== idx) { sum += +elems[i].value; } }
  let factor = (100 - val) / sum;
  for (let i = 0; i < num_waves; i++) { if (i !== idx) { elems[i].value *= factor; } }
}

/**
 * Decimates a data array by taking only every few elements from the array.
 */
function extract(data, step) {
  let out = new Float32Array(Math.ceil(data.length / step));
  for (let i = 0, j = 0; i < data.length; i+=step, j++) {
    out[j] = data[Math.round(i)];
  }
  return out;
}

/**
 * Decimates a data array by averaging only every few elements from the array.
 */
 function average_down(data, step) {
  let out = new Float32Array(Math.floor(data.length / step));
  for (let i = 0, j = 0; i < data.length; i+=step, j++) {
    let val = 0;
    for (let j = Math.round(i); j < i + step; j++) { val += data[j]; }
    out[j] = val / step;
  }
  return out;
}

function fft(data) {
  if (data.length % 2) {
    let padded = new Float32Array(data.length + 1);
    padded.set(data);
    padded[data.length] = 0;
    data = padded;
  }
  let fft = new pulse.fftReal(data.length);
  let fft_data = fft.forward(data);
  let real = extract(fft_data, 2);
  let imag = extract(fft_data.subarray(1), 2);
  return [real, imag];
}

function fft_basic(data, total_time, num_out) {
  const n = data.length, freq_factor = 2*Math.PI*total_time/(n*num_out);
  reals = new Float32Array(num_out);
  imags = new Float32Array(num_out);
  for (let j = 0; j < num_out; j++) {
    let x_sum = 0, y_sum = 0;
    const f = j * freq_factor;
    for (let i = 0; i < n; i++) {
      x_sum += data[i]*Math.cos(i*f);
      y_sum -= data[i]*Math.sin(i*f);
    }
    reals[j] = x_sum;
    imags[j] = y_sum;
  }
  return [reals, imags];
}