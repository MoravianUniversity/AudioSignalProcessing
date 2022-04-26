/*=================================================================
  Filename: Spectrogram-2v00.js
  Rev: 2
  By: Dr A.R.Collins
  Description: JavaScript graphics functions to draw Spectrograms.

  Date    Description                                       By
  -------|----------------------------------------------------|---
  12Nov18 First beta                                           ARC
  17Nov18 Added offset into data buffer                        ARC
  08May19 this.imageURL URL added
          bugfix: fixed isNaN test
          Changed sgStart, sgStop to start, stop
          Added options object to constructors                 ARC
  10May19 Enabled Left to Right as well as Top to Bottom       ARC
  11May19 Added RasterscanSVG                                  ARC
  12May19 Added blankline for horizontal raster scans          ARC
  13May19 Eliminated unnecessary putImageData                  ARC
  14May19 Removed toDataURL, not used drawImage is better
          bugfix: SVG RHC names swapped                        ARC
  02Jun19 bugfix: startOfs not honored in horizontalNewLine    ARC
  03Jun19 Flipped the SVG and RHC names for waterfalls         ARC
  04Jun19 Unflip SVG and RHC for horizontal mode               ARC
          Swap "SVG" & "RHC" strings to match fn names         ARC
  05Jun19 bugfix: WaterfallSVG scrolling wrong way             ARC
  10Jun19 bugfix: support lineRate=0 for static display
          bugfix: ipBufPtr must be a ptr to a ptr              ARC
  11Jun19 Make ipBuffers an Array of Arrays, if lineRate=0
          use all buffers else use only ipBuffer[0]            ARC
  13Jun19 Use Waterfall and Rasterscan plus direction
          Use Boolean rather than string compare               ARC
  16Jun19 Use const and let                                    ARC
  20Jun19 Change order of parameters                           ARC
  21Jun19 Add setLineRate method                               ARC
  06Jul19 Released as Rev 1v00                                 ARC
  25Jul21 Refactor using class, arrow functions etc            
          Added RasterImage object
          Use object.buffer as input not array of arrays       ARC
  25Jul21 Released as Rev 2v00                                 ARC
 =================================================================*/

var Waterfall, Rasterscan, RasterImage;

(function(){
  Waterfall = class extends Spectrogram
  {
    constructor(ipObj, w, h, dir, options)   // ipObj = {buffer: [..]}
    {
      var direction = (typeof(dir) === "string")? dir.toLowerCase() : "down";

      switch (direction)
      {
        case "up":
          super(ipObj, w, h, "WF", false, true, options);
          break;
        case "down":
        default:
          super(ipObj, w, h, "WF", true, true, options);
          break;
        case "left":
          super(ipObj, w, h, "WF", false, false, options);
          break;
        case "right":
          super(ipObj, w, h, "WF", true, false, options);
          break;
      }
    }
  }

  Rasterscan = class extends Spectrogram
  {
    constructor(ipObj, w, h, dir, options)   // ipObj = {buffer: [..]}
    {
      const direction = (typeof(dir) === "string")? dir.toLowerCase() : "down";

      switch (direction)
      {
        case "up":
          super(ipObj, w, h, "RS", true, true, options);
          break;
        case "down":
        default:
          super(ipObj, w, h, "RS", false, true, options);
          break;
        case "left":
          super(ipObj, w, h, "RS", false, false, options);
          break;
        case "right":
          super(ipObj, w, h, "RS", true, false, options);    
          break;
      }
    }
  }

  RasterImage = class
  {
    constructor(dataBuf, cols, rows, options={})  // dataBuf = Array[rows][cols]
    {
      const ipObj = {buffer:null};
      const dirs = ["up", "down", "left"];
      let direction = "down";
      let dirLC;

      if (options.hasOwnProperty("dir") && typeof(options.dir)==="string")
      {
        dirLC = options.dir.toLowerCase();
      }
      else if (options.hasOwnProperty("direction") && typeof(options.direction)==="string")
      {
        dirLC = options.direction.toLowerCase();
      }
      if (dirLC && dirs.includes(dirLC))
        direction = dirLC;

      // dataBuf values are each an index (0..255) into a colorMap
      // Each  of 256 colorMap entries holds the 4 values RGBA each (0..255) of a color

      // force static image
      options.lineRate = 0;
      const raster =  new Rasterscan(ipObj, cols, rows, direction, options);

      // now build a raster display line by line
      for (let r=0; r<rows; r++)
      {
        ipObj.buffer = dataBuf[r];
        raster.newLine();
      }

      return raster.offScreenCvs;
    }
  }
  
  function Spectrogram(ipObj, w, h, sgMode, rhc, vert, options)
  {
    const opt = (typeof options === 'object')? options: {};   // avoid undeclared object errors
    const pxPerLine = w || 200;
    const lines = h || 200;
    const lineBuf = new ArrayBuffer(pxPerLine * 4); // 1 line
    const lineBuf8 = new Uint8ClampedArray(lineBuf);
    const lineImgData = new ImageData(lineBuf8, pxPerLine, 1);  // 1 line of canvas pixels
    const blankBuf = new ArrayBuffer(pxPerLine * 4); // 1 line
    const blankBuf8 = new Uint8ClampedArray(blankBuf);
    const blankImgData = new ImageData(blankBuf8, pxPerLine, 1);  // 1 line of canvas pixels
    const clearBuf = new ArrayBuffer(pxPerLine * lines * 4);  // fills with 0s ie. rgba 0,0,0,0 = transparent
    const clearBuf8 = new Uint8ClampedArray(clearBuf);
    let offScreenCtx;   // offscreen canvas drawing context
    let clearImgData;
    let lineRate = 30;  // requested line rate for dynamic waterfalls
    let interval = 0;   // msec
    let startOfs = 0, endOfs = ipObj.buffer.length, logScale = false;
    let nextLine = 0;
    let timerID = null;
    let running = false;
    let sgTime = 0;
    let sgStartTime = 0;

    // Matlab Jet ref: stackoverflow.com grayscale-to-red-green-blue-matlab-jet-color-scale
    let colMap = [[   0,   0,   0, 255], [   3,   1,   1, 255], [   7,   2,   1, 255], [  10,   3,   2, 255],
                  [  13,   4,   2, 255], [  16,   5,   3, 255], [  18,   6,   3, 255], [  20,   7,   4, 255],
                  [  22,   8,   4, 255], [  24,   9,   5, 255], [  26,  10,   5, 255], [  27,  11,   6, 255],
                  [  29,  11,   6, 255], [  30,  12,   7, 255], [  32,  13,   8, 255], [  33,  14,   8, 255],
                  [  34,  15,   9, 255], [  36,  15,   9, 255], [  37,  16,  10, 255], [  38,  16,  10, 255],
                  [  40,  17,  11, 255], [  41,  17,  11, 255], [  43,  18,  12, 255], [  44,  18,  12, 255],
                  [  46,  18,  13, 255], [  47,  19,  13, 255], [  49,  19,  14, 255], [  50,  19,  14, 255],
                  [  52,  20,  15, 255], [  54,  20,  15, 255], [  55,  20,  15, 255], [  57,  21,  16, 255],
                  [  58,  21,  16, 255], [  60,  21,  16, 255], [  62,  22,  17, 255], [  63,  22,  17, 255],
                  [  65,  22,  17, 255], [  66,  23,  18, 255], [  68,  23,  18, 255], [  70,  23,  18, 255],
                  [  71,  24,  19, 255], [  73,  24,  19, 255], [  75,  24,  19, 255], [  76,  25,  20, 255],
                  [  78,  25,  20, 255], [  80,  25,  20, 255], [  81,  25,  20, 255], [  83,  26,  21, 255],
                  [  85,  26,  21, 255], [  86,  26,  21, 255], [  88,  26,  21, 255], [  90,  27,  22, 255],
                  [  91,  27,  22, 255], [  93,  27,  22, 255], [  95,  27,  22, 255], [  97,  28,  23, 255],
                  [  98,  28,  23, 255], [ 100,  28,  23, 255], [ 102,  28,  23, 255], [ 104,  29,  24, 255],
                  [ 105,  29,  24, 255], [ 107,  29,  24, 255], [ 109,  29,  24, 255], [ 111,  29,  25, 255],
                  [ 112,  30,  25, 255], [ 114,  30,  25, 255], [ 116,  30,  25, 255], [ 118,  30,  26, 255],
                  [ 119,  30,  26, 255], [ 121,  31,  26, 255], [ 123,  31,  26, 255], [ 125,  31,  27, 255],
                  [ 127,  31,  27, 255], [ 128,  31,  27, 255], [ 130,  31,  27, 255], [ 132,  32,  28, 255],
                  [ 134,  32,  28, 255], [ 136,  32,  28, 255], [ 137,  32,  28, 255], [ 139,  32,  29, 255],
                  [ 141,  32,  29, 255], [ 143,  32,  29, 255], [ 145,  33,  29, 255], [ 147,  33,  30, 255],
                  [ 148,  33,  30, 255], [ 150,  33,  30, 255], [ 152,  33,  31, 255], [ 154,  33,  31, 255],
                  [ 156,  33,  31, 255], [ 158,  33,  31, 255], [ 160,  33,  32, 255], [ 161,  34,  32, 255],
                  [ 163,  34,  32, 255], [ 165,  34,  32, 255], [ 167,  34,  33, 255], [ 169,  34,  33, 255],
                  [ 171,  34,  33, 255], [ 173,  34,  33, 255], [ 175,  34,  34, 255], [ 177,  34,  34, 255],
                  [ 178,  34,  34, 255], [ 179,  36,  34, 255], [ 180,  38,  34, 255], [ 181,  40,  33, 255],
                  [ 182,  42,  33, 255], [ 183,  44,  33, 255], [ 184,  45,  33, 255], [ 185,  47,  32, 255],
                  [ 186,  49,  32, 255], [ 187,  50,  32, 255], [ 188,  52,  31, 255], [ 189,  53,  31, 255],
                  [ 190,  55,  31, 255], [ 191,  56,  31, 255], [ 192,  58,  30, 255], [ 193,  59,  30, 255],
                  [ 194,  61,  30, 255], [ 195,  62,  29, 255], [ 196,  64,  29, 255], [ 197,  65,  28, 255],
                  [ 198,  66,  28, 255], [ 199,  68,  28, 255], [ 200,  69,  27, 255], [ 201,  71,  27, 255],
                  [ 202,  72,  26, 255], [ 203,  73,  26, 255], [ 204,  75,  25, 255], [ 205,  76,  25, 255],
                  [ 206,  77,  24, 255], [ 207,  79,  24, 255], [ 208,  80,  23, 255], [ 209,  82,  23, 255],
                  [ 210,  83,  22, 255], [ 211,  84,  21, 255], [ 212,  85,  21, 255], [ 213,  87,  20, 255],
                  [ 214,  88,  19, 255], [ 215,  89,  19, 255], [ 216,  91,  18, 255], [ 217,  92,  17, 255],
                  [ 218,  93,  16, 255], [ 219,  95,  15, 255], [ 220,  96,  14, 255], [ 221,  97,  13, 255],
                  [ 222,  98,  12, 255], [ 223, 100,  11, 255], [ 224, 101,   9, 255], [ 225, 102,   8, 255],
                  [ 226, 104,   7, 255], [ 227, 105,   5, 255], [ 227, 107,   5, 255], [ 227, 109,   6, 255],
                  [ 228, 110,   7, 255], [ 228, 112,   7, 255], [ 228, 114,   8, 255], [ 228, 116,   8, 255],
                  [ 229, 118,   9, 255], [ 229, 119,  10, 255], [ 229, 121,  10, 255], [ 229, 123,  11, 255],
                  [ 229, 124,  12, 255], [ 230, 126,  12, 255], [ 230, 128,  13, 255], [ 230, 130,  14, 255],
                  [ 230, 131,  14, 255], [ 230, 133,  15, 255], [ 230, 135,  15, 255], [ 231, 136,  16, 255],
                  [ 231, 138,  17, 255], [ 231, 140,  17, 255], [ 231, 141,  18, 255], [ 231, 143,  19, 255],
                  [ 231, 145,  19, 255], [ 231, 146,  20, 255], [ 232, 148,  21, 255], [ 232, 150,  21, 255],
                  [ 232, 151,  22, 255], [ 232, 153,  22, 255], [ 232, 154,  23, 255], [ 232, 156,  24, 255],
                  [ 232, 158,  24, 255], [ 232, 159,  25, 255], [ 232, 161,  26, 255], [ 232, 162,  26, 255],
                  [ 233, 164,  27, 255], [ 233, 166,  27, 255], [ 233, 167,  28, 255], [ 233, 169,  29, 255],
                  [ 233, 170,  29, 255], [ 233, 172,  30, 255], [ 233, 174,  30, 255], [ 233, 175,  31, 255],
                  [ 233, 177,  32, 255], [ 233, 178,  32, 255], [ 233, 180,  33, 255], [ 233, 181,  34, 255],
                  [ 233, 183,  34, 255], [ 233, 185,  35, 255], [ 233, 186,  35, 255], [ 233, 188,  36, 255],
                  [ 233, 189,  37, 255], [ 233, 191,  37, 255], [ 233, 192,  38, 255], [ 233, 194,  38, 255],
                  [ 233, 195,  39, 255], [ 233, 197,  40, 255], [ 233, 199,  40, 255], [ 233, 200,  41, 255],
                  [ 232, 202,  42, 255], [ 232, 203,  42, 255], [ 232, 205,  43, 255], [ 232, 206,  43, 255],
                  [ 232, 208,  44, 255], [ 232, 209,  45, 255], [ 232, 211,  45, 255], [ 232, 213,  46, 255],
                  [ 232, 214,  47, 255], [ 232, 216,  47, 255], [ 231, 217,  48, 255], [ 231, 219,  48, 255],
                  [ 231, 220,  49, 255], [ 231, 222,  50, 255], [ 231, 223,  50, 255], [ 231, 225,  51, 255],
                  [ 230, 226,  52, 255], [ 230, 228,  52, 255], [ 230, 229,  53, 255], [ 231, 231,  60, 255],
                  [ 233, 231,  69, 255], [ 234, 232,  78, 255], [ 236, 233,  87, 255], [ 237, 234,  94, 255],
                  [ 238, 235, 102, 255], [ 240, 236, 109, 255], [ 241, 236, 117, 255], [ 242, 237, 124, 255],
                  [ 243, 238, 131, 255], [ 245, 239, 137, 255], [ 246, 240, 144, 255], [ 247, 241, 151, 255],
                  [ 248, 241, 158, 255], [ 249, 242, 164, 255], [ 249, 243, 171, 255], [ 250, 244, 177, 255],
                  [ 251, 245, 184, 255], [ 252, 246, 190, 255], [ 252, 247, 197, 255], [ 253, 248, 203, 255],
                  [ 253, 249, 210, 255], [ 254, 249, 216, 255], [ 254, 250, 223, 255], [ 254, 251, 229, 255],
                  [ 255, 252, 236, 255], [ 255, 253, 242, 255], [ 255, 254, 249, 255], [ 255, 255, 255, 255],
                  [  0,   0,   0,   0]];

    const incrLine = () =>
    {
      if ((vert && !rhc) || (!vert && rhc))
      {  
        nextLine++;
        if (nextLine >= lines)
        {
          nextLine = 0;
        }
      }
      else
      {
        nextLine--;
        if (nextLine < 0)
        {
          nextLine = lines-1;
        }
      }
    }

    const updateWaterfall = () =>  // update dynamic waterfalls at a fixed rate
    {
      let sgDiff;
      
      // grab latest line of data, write it to off screen buffer, inc 'nextLine'
      this.newLine();
      // loop to write data data at the desired rate, data is being updated asynchronously
      // ref for accurate timeout: http://www.sitepoint.com/creating-accurate-timers-in-javascript
      sgTime += interval;
      sgDiff = (Date.now() - sgStartTime) - sgTime;
      if (running)
      {
        timerID = setTimeout(updateWaterfall, interval - sgDiff);
      }
    }

    const setProperty = (propertyName, value) =>
    {
      if ((typeof propertyName !== "string")||(value === undefined))  // null is OK, forces default
      {
        return;
      }
      switch (propertyName.toLowerCase())
      {
        case "linerate":
          this.setLineRate(value);  // setLine does checks for number etc
        break;
        case "startbin":
          if (!isNaN(value) && value >= 0) { startOfs = value; }
        break;
        case "endbin":
          if (!isNaN(value) && value >= 0) { endOfs = value; }
        break;
        case "logscale":
          if (!isNaN(value)) { logScale = !!value; }
        break;
        case "colormap":
          if (Array.isArray(value) && Array.isArray(value[0]) && value[0].length == 4)
          {
            colMap = value; // value must be an array of 4 element arrays to get here
            if (colMap.length<256)  // fill out the remaining colors with last color
            {
              for (let i=colMap.length; i<256; i++)
              {
                colMap[i] = colMap[colMap.length-1];
              }
            }
          }
        break;
        default:
        break;
      }
    }
  
    const verticalNewLine = () => 
    {
      let tmpImgData, ipBuf8;

      if (sgMode == "WF")
      {
        if (rhc)
        {
          // shift the current display down 1 line, oldest line drops off
          tmpImgData = offScreenCtx.getImageData(0, 0, pxPerLine, lines-1);
          offScreenCtx.putImageData(tmpImgData, 0, 1);
        }
        else
        {
          // shift the current display up 1 line, oldest line drops off
          tmpImgData = offScreenCtx.getImageData(0, 1, pxPerLine, lines-1);
          offScreenCtx.putImageData(tmpImgData, 0, 0);
        }
      }
      ipBuf8 = Uint8ClampedArray.from(ipObj.buffer);
      for (let sigVal, rgba, opIdx = 0, ipIdx = startOfs; ipIdx < pxPerLine+startOfs; opIdx += 4, ipIdx++) 
      {
        sigVal = ipBuf8[Math.round(factor*ipIdx)];
        rgba = colMap[sigVal];  // array of rgba values
        // byte reverse so number aa bb gg rr
        lineBuf8[opIdx] = rgba[0];   // red
        lineBuf8[opIdx+1] = rgba[1]; // green
        lineBuf8[opIdx+2] = rgba[2]; // blue
        lineBuf8[opIdx+3] = rgba[3]; // alpha
      }
      offScreenCtx.putImageData(lineImgData, 0, nextLine);
      if (sgMode === "RS")
      {
        incrLine();
        // if not static draw a white line in front of the current line to indicate new data point
        if (lineRate) 
        {
          offScreenCtx.putImageData(blankImgData, 0, nextLine);
        }
      }
    }

    let displayed = false;

    const horizontalNewLine = () => 
    {
      let tmpImgData, ipBuf8;

      if (sgMode == "WF")
      {
        if (rhc)
        {
          // shift the current display right 1 line, oldest line drops off
          tmpImgData = offScreenCtx.getImageData(0, 0, lines-1, pxPerLine);
          offScreenCtx.putImageData(tmpImgData, 1, 0);
        }
        else
        {
          // shift the current display left 1 line, oldest line drops off
          tmpImgData = offScreenCtx.getImageData(1, 0, lines-1, pxPerLine);
          offScreenCtx.putImageData(tmpImgData, 0, 0);
        }
      }
      // refresh the page image (it was just shifted)
      const pageImgData = offScreenCtx.getImageData(0, 0, lines, pxPerLine);
      ipBuf8 = ipObj.buffer;
      if (ipBuf8.constructor !== Uint8Array)
      {
        ipBuf8 = Uint8ClampedArray.from(ipBuf8); // clamp input values to 0..255 range
      }

      const factor = (endOfs-startOfs) / (logScale ? (Math.pow(2, (pxPerLine-1)/48) - 1) : pxPerLine);
      for (let sigVal, rgba, opIdx, ipIdx=0; ipIdx < pxPerLine; ipIdx++) 
      {
        // integrate across the bins
        // TODO: should have an exponential dpendcy on the integral when log-scaling
        let i_prv = factor * (logScale ? (Math.pow(2, (ipIdx-0.5)/48)-1) : (ipIdx-0.5)) + startOfs;
        //let i_cur = factor * (logScale ? (Math.pow(2, ipIdx/48)-1) : ipIdx) + startOfs;
        let i_nxt = factor * (logScale ? (Math.pow(2, (ipIdx+0.5)/48)-1) : (ipIdx+0.5)) + startOfs;
        let sigVal = 0;
        for (let i = Math.max(Math.ceil(i_prv), 0); i < Math.min(Math.floor(i_nxt), ipBuf8.length); i++) {
          sigVal += ipBuf8[i];
        }
        sigVal += (1-i_prv+Math.floor(i_prv))*ipBuf8[Math.floor(i_prv)];
        sigVal += (i_nxt-Math.floor(i_nxt))*ipBuf8[Math.floor(i_nxt)];
        sigVal = Math.round(sigVal / (i_nxt - i_prv));
        rgba = colMap[Math.max(Math.min(sigVal, 255), 0)];  // array of rgba values
        opIdx = 4*((pxPerLine-ipIdx-1)*lines+nextLine);
        // byte reverse so number aa bb gg rr
        pageImgData.data[opIdx] = rgba[0];   // red
        pageImgData.data[opIdx+1] = rgba[1]; // green
        pageImgData.data[opIdx+2] = rgba[2]; // blue
        pageImgData.data[opIdx+3] = rgba[3]; // alpha
      }
      displayed = true;
      if (sgMode === "RS")
      {
        incrLine();
        // if not draw a white line in front of the current line to indicate new data point
        if (lineRate) 
        {
          for (let j=0; j < pxPerLine; j++) 
          {
            if (rhc)
            {
              opIdx = 4*(j*lines+nextLine);
            }
            else
            {
              opIdx = 4*((pxPerLine-j-1)*lines+nextLine);
            }
            // byte reverse so number aa bb gg rr
            pageImgData.data[opIdx] = 255;   // red
            pageImgData.data[opIdx+1] = 255; // green
            pageImgData.data[opIdx+2] = 255; // blue
            pageImgData.data[opIdx+3] = 255; // alpha
          }
        }
      } 
      offScreenCtx.putImageData(pageImgData, 0, 0);
    }

    const createOffScreenCanvas = ()=>
    {
      const cvs  = document.createElement("canvas");
      if (vert)
      {
        cvs.setAttribute('width', pxPerLine);   // reset canvas pixels width
        cvs.setAttribute('height', lines);      // don't use style for this
        clearImgData = new ImageData(clearBuf8, pxPerLine, lines);
      }
      else // data written in columns
      {
        cvs.setAttribute('width', lines);       // reset canvas pixels width
        cvs.setAttribute('height', pxPerLine);  // don't use style for this
        clearImgData = new ImageData(clearBuf8, lines, pxPerLine);
      }
      offScreenCtx = cvs.getContext("2d");

      return cvs;
    }


// ===== now make the exposed properties and methods ===============

    this.newLine = (vert)? verticalNewLine: horizontalNewLine;  // function pointers

    this.offScreenCvs = createOffScreenCanvas();

    this.setLineRate = function sgSetLineRate(newRate)
    {
      if (isNaN(newRate) || newRate > 50 || newRate < 0)
      {
        console.error("invalid line rate [0 <= lineRate < 50 lines/sec]");
        // don't change the lineRate;
      }
      else if (newRate === 0)  // static (one pass) raster
      {
        lineRate = 0;
      }
      else
      {
        lineRate = newRate;
        interval = 1000/lineRate;  // msec
      }
    };

    this.clear = function()
    {
      offScreenCtx.putImageData(clearImgData, 0, 0);
    };

    this.start = function()
    {
      sgStartTime = Date.now();   
      sgTime = 0;
      running = true;
      updateWaterfall();  // start the update loop
    };

    this.stop = function()
    {
      running = false;
      if (timerID)
      {
        clearTimeout(timerID);
      }
      // reset where the next line is to be written
      if (sgMode === "RS")
      {
        if (vert)
        {
          nextLine = (rhc)? lines-1 : 0;
        }
        else
        {
          nextLine = (rhc)? 0 : lines-1;
        }
      }
      else // WF
      {
        nextLine = (rhc)? 0 :  lines-1;  
      }
    };

    //===== set all the options  ================
    for (let prop in opt)
    {
      // check that this is opt's own property, not inherited from prototype
      if (opt.hasOwnProperty(prop))
      {
        setProperty(prop, opt[prop]);
      }
    }

    // make a white line, it will show the input line for RS displays
    blankBuf8.fill(255);
    // make a full canvas of the color map 0 values
    for (let i=0; i<pxPerLine*lines*4; i+=4) 
    {
      // byte reverse so number aa bb gg rr
      clearBuf8[i] = colMap[0][0];   // red
      clearBuf8[i+1] = colMap[0][1]; // green
      clearBuf8[i+2] = colMap[0][2]; // blue
      clearBuf8[i+3] = colMap[0][3]; // alpha
    }
    // initialize the direction and first line position
    this.stop();

    // everything is set 
    // if dynamic, wait for the start or newLine methods to be called
  } 
}())