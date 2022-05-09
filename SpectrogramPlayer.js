/**
 * Draws the waveform from the data onto the canvas context. Only the "central"
 * n values from the data are drawn. The center is determined so to align each
 * drawing with the previous drawing. This can only be used once for each
 * canvas. The alignment mostly works but not entirely perfect. Alignment uses
 * the xcorr library.
 */
function drawAlignedWaveform(context, data, n) {
  const len = data.length;
  data = new Float32Array(data);
  for (let i = 0; i < len; i++) { data[i] = data[i]/128 - 1; }
  if (typeof n === "undefined") { n = len; }
  else if (n !== len) {
    if (typeof context._last_data !== "undefined") {
      xcorr.correlate(context._last_data, data).then((buffer) => {
        const buf_len = buffer.length, buf_len_2 = 0.5*buf_len;
        let max_left_i = 0, max_left = buffer[0];
        let max_right_i = buf_len-1, max_right = buffer[max_right_i];
        for (let i = 1; i <= buf_len_2; i++) {
          let left = buffer[i];
          if (left > max_left) { max_left_i = i; max_left = left; }
          let right = buffer[buf_len-i-1];
          if (right > max_right) { max_right_i = buf_len-i-1; max_right = right; }
        }
        let left = (Math.abs(max_left - max_right) < 0.01) ? Math.random()>=0.5 : max_left > max_right;
        let max_i = left ? max_left_i : max_right_i;

        // make sure we aren't getting too close to either end of the data
        // TODO: this isn't quite right and slowly moves to the left
        // probably need to adjust the 0.5's below, just not sure how or why
        const half_n = 0.5*n;
        let mid = context._last_middle - max_i + len - (left ? -0.5 : 0.5);
        if (mid > len - half_n) {
          mid = context._last_middle - max_right_i + len - 0.5;
        } else if (mid < half_n) {
          mid = context._last_middle - max_left_i + len + 0.5;
        }

        // save
        context._last_middle = mid;
        context._last_data = data;

        // draw
        const start = Math.floor(mid-half_n);
        _drawWaveform(context, data.subarray(start, start+n));
      });
    } else {
      // assume middle
      context._last_data = data;
      let mid = context._last_middle = len/2;
      const start = Math.floor(mid-0.5*n);
      _drawWaveform(context, data.subarray(start, start+n));
    }
  } else {
    _drawWaveform(context, data);
  }
}

/**
 * Internal function for drawAlignedWaveform() that does the actual drawing
 * once the data has been cropped to the aligned sequence.
 */
function _drawWaveform(context, data) {
  clearCanvas(context);
  context.strokeStyle = 'lime';
  context.lineWidth = 1.5;
  plot(context, data);
}

/**
 * Spectrogram display with player controls. The audio context is the context
 * to which results will be sent (and used to create nodes). source_gen is a
 * function that takes a reference to this spectrogram player and the audio
 * context (although the audio context is obtainable through the audio_context
 * attribute). The function returns a single or an array of source nodes. Each
 * source node is hooked up to a gain node automatically. The element is the
 * parent element of the player. The options are used to set various options of
 * the player:
 *   - width: the width (in px) of the player, defaults to the element's width
 *   - height: the height (in px) of the player, defaults to 250px
 *   - rewind: include a rewind button, defaults to true
 *   - autoplay: if auto-playing should be attempted, defaults to false, may
 *     not work if true due to browser restrictions
 *   - waveform: display the waveform of the current audio, defaults to false
 *   - microphone: support microphones, doesn't play audio out and forces
 *     rewind to false
 *   - post_setup: function to call once audio is ready to be played, takes
 *     a reference to this player, useful for adjusting the gain nodes
 * 
 * Attributes:
 *   - audio_context
 *   - gain_nodes: null (if stopped) or list of gain nodes
 *   - source_nodes: null (if stopped) or list of source nodes
 *   - spectrogram: spectrogram display object 
 *   - canvas: canvas for drawing spectrogram on
 *   - canvas_context: context for the above canvas
 *   - canvas_waveform: canvas for drawing waveform on (if waveform option)
 *   - canvas_context_waveform: context for the above canvas
 *   - controls: element containing the controls
 *   - rewind_button: rewind button element (if rewind option)
 *   - play_pause_button: play button element
 * 
 * Methods:
 *   - playing(): returns true if currently playing
 *   - play(): start playing the audio
 *   - pause(): stop playing but remember the current position
 *   - stop(): stop playing and reset current position
 *   - rewind(): keep playing (if playing) but reset the current position
 *   - play_pause(): pause if currently playing, play if currently stopped
 *   - draw(): update the visuals, do not call yourself as it will cause
 *     animation issues
 */

function SpectrogramPlayer(audio_context, source_gen, element, options) {
  options = Object.assign(
    {
      width:null, height:250, rewind:true, autoplay:false,
      waveform:false, microphone:false, post_setup:null,
    }, options
  );
  const width = options.width || element.offsetWidth, height = options.height;
  const has_rewind = options.rewind, autoplay = options.autoplay;
  const waveform = options.waveform;
  const is_microphone = options.microphone;
  const post_setup = options.post_setup;

  ///// Setup Audio Context and Nodes /////
  this.audio_context = audio_context;
  // analyser branch (doesn't go to destination)
  // the source will be connected to the splitterNode by the player controls
  const splitterNode = audio_context.createChannelSplitter(2);
  const lftAnalyserNode = audio_context.createAnalyser();
  const rgtAnalyserNode = audio_context.createAnalyser();
  // analyser branch: splitterNode 0 to lftAnalyser, splitterNode 1 to rgtAnalyser
  splitterNode.connect(lftAnalyserNode, 0);
  splitterNode.connect(rgtAnalyserNode, 1);
  // now connect the analyser channels to the DSP processor and display    
  // player branch, source (connected in player controls) connects to gain connects to destination
  this.gain_nodes = null;
  this.source_nodes = null;
  let startedAt = 0, pausedAt = 0;

  ///// Setup Spectorgram /////
  lftAnalyserNode.fftSize = 2048*4;  // doubled frequency resolution by halfing time resolution
  lftAnalyserNode.maxDecibels = -30;
  lftAnalyserNode.minDecibels = -70;
  lftAnalyserNode.smoothingTimeConstant = 0.2;
  const freq_buffer = new Uint8Array(lftAnalyserNode.frequencyBinCount); // half of the fftSize, which defaults ot 2048
  this.spectrogram = new Waterfall({buffer: freq_buffer}, height, width, "right", {
    startBin:2, endBin:(256+128)*4, logScale:true // 
  });
  this.spectrogram.setLineRate(45);
  this.canvas = element.appendChild(document.createElement('canvas'));
  this.canvas.width = width; this.canvas.height = height;
  this.canvas_context = this.canvas.getContext("2d");

  ///// Setup Waveform /////
  // rgtAnalyserNode.fftSize = 2048/2;
  // rgtAnalyserNode.maxDecibels = -30;
  // rgtAnalyserNode.minDecibels = -70;
  // const time_buffer = new Uint8Array(rgtAnalyserNode.fftSize);
  const time_buffer = new Uint8Array(lftAnalyserNode.fftSize);  
  if (waveform) {
    this.canvas_waveform = element.appendChild(document.createElement('canvas'));
    this.canvas_waveform.width = width; this.canvas_waveform.height = 50;
    this.canvas_context_waveform = this.canvas_waveform.getContext("2d");
  }

  this.playing = () => { return this.source_nodes !== null; }

  this.play = () => {
    if (this.source_nodes !== null) { return; }

    let offset = pausedAt;
    if (offset === 0) { this.spectrogram.clear(); }

    // Must create a new source node each time we restart
    audio_context.resume();
    this.source_nodes = source_gen(this, audio_context);
    if (!Array.isArray(this.source_nodes)) { this.source_nodes = [this.source_nodes]; }
    this.gain_nodes = [];
    for (let sn of this.source_nodes) {
      let gn = audio_context.createGain();
      this.gain_nodes.push(gn);
      sn.connect(gn);
      gn.connect(splitterNode);
      if (!is_microphone) { gn.connect(audio_context.destination); }
      if (sn.start) { sn.start(0, offset); }
    }
    if (post_setup !== null) { post_setup(this); }

    startedAt = audio_context.currentTime - offset;
    pausedAt = 0;
    this.spectrogram.start();
    this.draw();
  };

  this.pause = () => {
    let elapsed = audio_context.currentTime - startedAt;
    this.stop();
    pausedAt = elapsed;
  };

  this.play_pause = () => { if (this.playing()) { this.pause(); } else { this.play(); } };

  this.stop = () => {
    if (this.source_nodes !== null) {
      for (let sn of this.source_nodes) {
        sn.disconnect();
        if (!is_microphone) { sn.stop(0); }
      }
      this.source_nodes = null;
      for (let gn of this.gain_nodes) { gn.disconnect(); }
      this.gain_nodes = null;
      this.spectrogram.stop();
    }
    pausedAt = startedAt = 0;
  };

  this.rewind = () => {
    if (this.playing()) { this.stop(); this.play(); }
    else {
      pausedAt = 0;
      this.spectrogram.clear();
      this.canvas_context.drawImage(this.spectrogram.offScreenCvs, 0, 0);
      if (waveform) { this.canvas_context_waveform.clearRect(0, 0, width, 100); }
    }
  };

  this.draw = () => {
    if (!this.playing()) { return; }
    requestAnimationFrame(this.draw);

    lftAnalyserNode.getByteFrequencyData(freq_buffer);
    this.canvas_context.drawImage(this.spectrogram.offScreenCvs, 0, 0);
    if (waveform) {
      lftAnalyserNode.getByteTimeDomainData(time_buffer);
      drawAlignedWaveform(this.canvas_context_waveform, time_buffer, 1024);
    }
  };

  ///// Setup Display /////
  this.controls = element.appendChild(document.createElement('div'));
  this.controls.classList.add("controls");
  if (has_rewind && !is_microphone) {
    this.rewind_button = this.controls.appendChild(document.createElement("span"));
    this.rewind_button.classList.add("button");
    this.rewind_button.classList.add("rewind");
    this.rewind_button.textContent = "◀◀" // "\u23EE\uFE0E";
    this.rewind_button.addEventListener("click", this.rewind);
  }
  this.play_pause_button = this.controls.appendChild(document.createElement("span"));
  this.play_pause_button.classList.add("button");
  this.play_pause_button.classList.add("play-pause");
  this.play_pause_button.textContent = "▶||"; // "\u23EF\uFE0E";
  this.play_pause_button.addEventListener("click", this.play_pause);
  if (autoplay) { this.play(); }
}
