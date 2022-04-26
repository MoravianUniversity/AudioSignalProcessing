function drawWaveform(canvas_context, data, n) {
  if (typeof n === "undefined") { n = data.length; }
  const width = canvas_context.canvas.width, height = canvas_context.canvas.height;
  canvas_context.fillStyle = 'rgb(255, 255, 255)';  // 200?
  canvas_context.fillRect(0, 0, width, height);
  canvas_context.lineWidth = 1.5;
  canvas_context.strokeStyle = 'rgba(0, 0, 0, 0.75)';
  canvas_context.beginPath();
  const sliceWidth = width / n;
  if (n !== data.length) {
    let start = Math.floor((data.length - n) / 2);
    // if (typeof canvas_context._last_data !== "undefined") {
      // xcorr.timeLag(canvas_context._last_data, data).then((offset) => {
      //   console.log(offset);
      // });
      // offset = xcorr(canvas_context._last_data, data);  // TODO: perform a cross corelation with the last signal to get the best alignment
      // start = offset - Math.floor(n/2);
    // }
    canvas_context._last_data = data.slice();
    data = data.subarray(start, start+n);
  }
  let x = 0;
  for (let i = 0; i < n; i++) {
    let y = data[i] / 128.0 * height/2;
    if (i === 0) { canvas_context.moveTo(x, y); }
    else { canvas_context.lineTo(x, y); }
    x += sliceWidth;
  }
  canvas_context.stroke();
}


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
      this.pausedAt = 0;
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
      drawWaveform(this.canvas_context_waveform, time_buffer, 1024);
    }
  };

  ///// Setup Display /////
  this.controls = element.appendChild(document.createElement('div'));
  this.controls.classList.add("controls");
  if (has_rewind && !is_microphone) {
    this.rewind_button = this.controls.appendChild(document.createElement("span"));
    this.rewind_button.classList.add("button");
    this.rewind_button.textContent = "⏮";
    this.rewind_button.addEventListener("click", this.rewind);
  }
  this.play_pause_button = this.controls.appendChild(document.createElement("span"));
  this.play_pause_button.classList.add("button");
  this.play_pause_button.textContent = "⏯";
  this.play_pause_button.addEventListener("click", this.play_pause);
  if (autoplay) { this.play(); }
}
