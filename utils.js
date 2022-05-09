/**
 * Utilities for Fourier transform demos. 
 * Author: Jeffrey Bush
 */

/**
 * Loads the audio file from the given URL using the given audio context.
 * The on load and on error functions are called upon loading the data or
 * if loading the data fails.
 */
function audioBufferLoader(context, url, onLoadFn, onErrorFn) {
  let onLoadCallback = onLoadFn || function(buffer){};
  let onErrorCallback = onErrorFn || function(){};
  let request = new XMLHttpRequest();
  request.open('GET', url);
  request.responseType = 'arraybuffer';
  request.onload = () => {
    context.decodeAudioData(request.response, onLoadCallback, onErrorCallback)
  }
  request.send();
}

/**
 * Create array of count linearly-spaced numbers from start to stop.
 */
function linspace(start, stop, count) {
  const step = (stop - start) / (count - 1);
  return Array.from({length: count}, (_, i) => start + step * i);
}

/**
 * Create array of count log2-spaced numbers from start to stop.
 */
function log2space(start, stop, count) {
  return linspace(Math.log2(start), Math.log2(stop), count).map(x => 2**x);
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
    const f = freqs[i]*factor;
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
 * Draws the data array onto the context. The scale applies to the values along
 * y axis (0 is always in the middle), if 'auto' computes it automatically from
 * the data. Default is 1.
 * 
 * The stride determines how many data points to skip along the x axis which
 * x_inc deterines how much to advance the x values when incrementing by stride.
 * log_scale causes log scaling along the x axis.
 * 
 * All arguments except the first two are optional.
 */
function plot(context, data, scale, stride, x_inc) {
  const width = context.canvas.width, height = context.canvas.height, n = data.length;

  if (typeof stride === "undefined") { stride = 1; }
  if (typeof scale === "undefined") { scale = 1; }
  if (!x_inc) { x_inc = stride / n * width; }
  if (scale === 'auto') {
    let max = data.reduce((prev, x) => (prev > x) ? prev : x, 0);
    let min = data.reduce((prev, x) => (prev < x) ? prev : x, 0);
    scale = 0.95/Math.max(Math.abs(max), Math.abs(min));
  }

  context.beginPath();
  for (let i = 0, x = 0; i < n; x += x_inc, i += stride) {
    let y = (1 - data[Math.round(i)] * scale) * height/2;
    if (i === 0) { context.moveTo(0, y); }
    else { context.lineTo(x, y); }
  }
  context.stroke();
}

/**
 * Draws a grid on a the canvas with vertical lines at all of the given indices
 * and a horizontal line in the middle.
 */
function drawGrid(context, indices, labels, options) {
  const width = context.canvas.width, height = context.canvas.height;
  options = Object.assign({color:'lightgray', pos:'center'}, options);
  context.font = '0.75em sans-serif';
  context.strokeStyle = context.fillStyle = options.color;
  context.lineWidth = 1;
  context.setLineDash([8.5, 4]);
  for (let i = 0; i < indices.length; i++) {
    let x = indices[i];
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height - 15);
    context.stroke();
    if (labels && labels[i] && x >= 0 && x < width) {
      const text = labels[i], metrics = context.measureText(text);
      if (options.pos === 'left') { x -= metrics.width + 4; }
      else if (options.pos === 'center') { x -= metrics.width / 2; }
      else { x += 4; } // right
      x = Math.min(Math.max(4, x), width - metrics.width - 4);
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
  plot(context, data, 'auto', stride, provided_total_seconds ? 1 : 0);
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

function drawFourier(context, data, seconds, min_freq, max_freq, musical) {
  const width = context.canvas.width, height = context.canvas.height, n = data.length;
  if (typeof use_pulse === "undefined") { use_pulse = true; }
  if (typeof musical === "undefined") { musical = false; }

  let reals, imags;
  let freqs = (musical ? log2space : linspace)(min_freq, max_freq, width);
  // This works, but is slow...
  // if (use_pulse && pulse !== null) {
  //   // use PulseFFT if available
  //   let [reals_orig, imags_orig] = fft(data);
  //   let fft_freqs = linspace(0, 0.5*n/seconds, reals_orig.length);
  //   reals = new Float32Array(freqs.length);
  //   imags = new Float32Array(freqs.length);
  //   for (let i = 0, j = 0; i < freqs.length; i++) {
  //     let f = freqs[i];
  //     for (; j < fft_freqs.length-1 && Math.abs(fft_freqs[j] - f) > Math.abs(fft_freqs[j+1] - f); j++) {}
  //     reals[i] = reals_orig[j];
  //     imags[i] = imags_orig[j];
  //   }
  // } else {
    [reals, imags] = ft_compute(data, seconds, freqs);
  // }
  reals[0] = 0;
  imags[0] = 0;

  let mags = new Float32Array(reals.length);
  // let phases = new Float32Array(reals.length);
  let max = 0;
  for (let j = 0; j < reals.length; j++) {
    mags[j] = Math.sqrt(reals[j] * reals[j] + imags[j] * imags[j]);
    // phases[j] = Math.atan2(imags[j], reals[j]);
    if (mags[j] > max) { max = mags[j]; }
  }

  // do the actual drawing
  clearCanvas(context);

  if (musical) {
    // color in the different octaves
    const octaves = [16.35, 32.70, 65.41, 130.81, 261.63,
                     523.25, 1046.50, 2093.00, 4186.01, 8372.02];
    const min_oct = Math.log2(min_freq), max_oct = Math.log2(max_freq);
    const min_oct_i = Math.max(octaves.findIndex((val) => val >= min_freq)-1, 0);
    const freq_px = width/(max_oct - min_oct);
    const colors = ['#440000', '#442200', '#444400', '#004400', '#004444',
                    '#000044', '#220044', '#440044', '#440022'];
    for (let i = min_oct_i; i < octaves.length - 1; i++) {
      let start = (Math.log2(octaves[i])-min_oct)*freq_px;
      let end = (Math.log2(octaves[i+1])-min_oct)*freq_px;
      context.fillStyle = colors[i-min_oct_i];
      context.fillRect(start, height-15, end-start, 15);
    }

    // naturals
    let freqs = [16.35, 18.35, 20.60, 21.83, 24.50, 27.50, 30.87,
      32.70, 36.71, 41.20, 43.65, 49.00, 55.00, 61.74,
      65.41, 73.42, 82.41, 87.31, 98.00, 110.00, 123.47,
      130.81, 146.83, 164.81, 174.61, 196.00, 220.00, 246.94,
      261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88,
      523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77,
      1046.50, 1174.66, 1318.51, 1396.91, 1567.98, 1760.00, 1975.53,
      2093.00, 2349.32, 2637.02, 2793.83, 3135.96, 3520.00, 3951.07,
      4186.01, 4698.63, 5274.04, 5587.65, 6271.93, 7040.00, 7902.13];
    let indices = new Array(freqs.length);
    let notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    let labels = new Array(freqs.length);
    for (let i = 0; i < freqs.length; i++) {
      indices[i] = Math.round((Math.log2(freqs[i])-min_oct)*freq_px);
      labels[i] = notes[i%notes.length];
    }
    drawGrid(context, indices, labels, {color:'white'});

    // sharps and flats
    let freqs2 = [17.32, 19.45, 23.12, 25.96, 29.14, 
      34.65, 38.89, 46.25, 51.91, 58.27, 
      69.30, 77.78, 92.50, 103.83, 116.54, 
      138.59, 155.56, 185.00, 207.65, 233.08, 
      277.18, 311.13, 369.99, 415.30, 466.16, 
      554.37, 622.25, 739.99, 830.61, 932.33, 
      1108.73, 1244.51, 1479.98, 1661.22, 1864.66, 
      2217.46, 2489.02, 2959.96, 3322.44, 3729.31, 
      4434.92, 4978.03, 5919.91, 6644.88, 7458.62];
    freqs2 = freqs2.filter((val) => (val >= min_freq && val <= max_freq));
    let indices2 = new Array(freqs2.length);
    for (let i = 0; i < freqs2.length; i++) {
      indices2[i] = Math.round((Math.log2(freqs2[i])-min_oct)*freq_px);
    }
    drawGrid(context, indices2, null, {color:'#666666'});
  } else {
    let indices = [], labels = [];
    for (let f = min_freq; f <= max_freq; f++) {
      indices.push(Math.round(f*width/(max_freq-min_freq)));
      labels.push(f + " Hz");
    }
    drawGrid(context, indices, labels);
  }

  // draw the curves
  context.lineWidth = 2;
  context.strokeStyle = '#FF8888';
  plot(context, reals, 0.95/max);
  context.strokeStyle = '#8888FF';
  plot(context, imags, 0.95/max);
  context.strokeStyle = 'white';
  plot(context, mags, 0.95/max);
  // context.strokeStyle = 'gray';
  // plot(context, phases, 0.95/(2*Math.PI));
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
  context.lineTo(x1 - head_len * Math.cos(angle - head_angle),
                 y1 - head_len * Math.sin(angle - head_angle));
  context.lineTo(x1 - head_len * Math.cos(angle + head_angle),
                 y1 - head_len * Math.sin(angle + head_angle));
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

/**
 * Performs a basic Fourier transform on the given data which represents the
 * given amount of time in seconds. It outputs one sample for each frequency
 * requested. Returns the real and imaginary values.
 */
function ft_compute(data, seconds, freqs) {
  const n = data.length, num_out = freqs.length, freq_factor = 2*Math.PI*seconds/n;
  let reals = new Float32Array(num_out);
  let imags = new Float32Array(num_out);
  for (let j = 0; j < num_out; j++) {
    let x_sum = 0, y_sum = 0;
    const f = freqs[j] * freq_factor;
    for (let i = 0; i < n; i++) {
      x_sum += data[i]*Math.cos(i*f);
      y_sum -= data[i]*Math.sin(i*f);
    }
    reals[j] = x_sum;
    imags[j] = y_sum;
  }
  return [reals, imags];
}

// Load Pulse FFT library if available, much faster than the basic FT here
let pulse = null;
window.addEventListener('load', () => {
  if (typeof loadPulse !== "undefined") {
    loadPulse().then((p) => { pulse = p; });
  }
});

/**
 * Perform FFT using Pulse FFT library.
 */
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