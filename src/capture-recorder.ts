import './index.css';

const store: Map<string, {type: string; data: any;}> = new Map();

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

const findDevicesByLabel = async (str: string) => {
  const list = await navigator.mediaDevices.enumerateDevices();
  const filtered = list.filter(({label}) => label.toLowerCase().indexOf(str.toLowerCase()) !== -1);
  return filtered.reduce((acc, data) => {
    const group = acc.find(({groupId}) => groupId === data.groupId) || (acc.push({groupId: data.groupId, devices: []}), acc[acc.length - 1]);
    group.devices.push(data);
    return acc;    
  }, [] as {groupId: string; devices: MediaDeviceInfo[]}[]);
};

async function webcamLoaded() {
  const devices = await findDevicesByLabel(WEBCAM_NAME);
  if (devices.length > 1) console.warn('To many groups!', devices);
  const group = devices[0];
  const videoDevice = group?.devices.find(({ kind }) => kind === 'videoinput');

  if (videoDevice) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 4096 },
        height: { ideal: 2160 },
        frameRate: { max: 60, min: 30 },
        deviceId: { exact: videoDevice.deviceId },
      },
    });
    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();
    store.set('webcam', {type: 'webcam', data: video});
    store.set('stream', {type: 'stream', data: stream});
  } else {
    console.error('No video device!');
    const img = await new Promise<HTMLImageElement>(res => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => res(img);
      img.src = 'https://dummyimage.com/600x100/666666/ffffff&text=Webcam+not+connected';
    });
    store.set('webcam', {type: 'webcam', data: img});
  }
}

const raf = new class Raf extends Set<Function> {
  private playing = true;
  constructor(){
    super();

    const self = this;
    requestAnimationFrame(function draw(time) {
      self.playing && self.forEach(f => f());
      requestAnimationFrame(draw);
    });
  }
  on() {
    this.playing = true
  }
  off(){
    this.playing = false
  }
}

function showImages(images: Blob[], container: HTMLDivElement) {
  const imageEls = images.map(blob => {
    const imageUrl = window.URL.createObjectURL(blob);
    const imgElem = new Image();
    imgElem.src = imageUrl;
    container.appendChild(imgElem);
    return imgElem
  })
  return imageEls;
}


const WEBCAM_NAME = 'C922';
const main = async () => {try {
  await webcamLoaded();
  
  const {data: webcamVideo } = store.get('webcam') as {type: string; data: HTMLVideoElement};
  const {data: stream} = store.get('stream') as {type: string; data: MediaStream};
  
  const webcamCanvas = document.getElementById('canvas') as HTMLCanvasElement;
  const webcamCtx = webcamCanvas.getContext('2d') as CanvasRenderingContext2D;
  webcamCanvas.width = 800;
  webcamCanvas.height = 800;

  raf.add(() => {
    webcamCtx.drawImage(webcamVideo, 0, 0, webcamCtx.canvas.width, webcamCtx.canvas.height);
  });
  
  let captureInterval: any;
  const imageStore: Blob[] = [];

  const startBtn = document.getElementById('start') as HTMLButtonElement;
  // const stopBtn = document.getElementById('stop') as HTMLButtonElement;
  const recordBtn = document.getElementById('record') as HTMLButtonElement;
  const imagesDiv = document.getElementById("images") as HTMLDivElement;
  const resultVideo = document.getElementById("video") as HTMLVideoElement;

  startBtn.onclick = async () => {
    const canvas = document.createElement("canvas")  as HTMLCanvasElement;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    canvas.width = webcamCanvas.width;
    canvas.height = webcamCanvas.height;

    // const [track] = stream.getVideoTracks();
    captureInterval = setInterval(async() => {
      ctx.drawImage(webcamVideo, 0, 0, ctx.canvas.width, ctx.canvas.height);
      canvas.toBlob((blob) => {
        if (blob === null) {
          console.log("Failed to convert canvas to blob");
          return;
        }
        console.log(blob);
        imageStore.push(blob);
      });
    }, 1000);
  }

  setTimeout(() => {
    clearInterval(captureInterval);
    // close the camera
    // stream.getTracks().forEach((track) => track.stop());
    if (imageStore.length > 0) {
      const imagesURL =  showImages(imageStore, imagesDiv);
      store.set('images', {type: 'blob', data: imagesURL});
    }
  }, 12000);
  // stopBtn.onclick = () => { }

  recordBtn.onclick = async () => {
    const {data: images} = store.get('images') as {type: string; data: HTMLImageElement[]};
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    canvas.width = webcamCtx.canvas.width;
    canvas.height = webcamCtx.canvas.height;
    
    const canvasStream = canvas.captureStream(60);
    const canvasTrack = canvasStream.getTracks()[0];
    
    const stream = new MediaStream([canvasTrack]);
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream);

    recorder.ondataavailable = ({data}) => {
      chunks.push(data);
    }
    // recorder.onstop = function(e) {
    //   const blob = new Blob(chunks, { 'type' : 'video/mp4' });
    //   const videoURL = URL.createObjectURL(blob);
    //   resultVideo.src = videoURL;
    //   resultVideo.play();
    // };
    recorder.start();
    let index = 0;
    let drawInterval: any;
    drawInterval = setInterval(() => {
      if (index >= images.length) return clearInterval(drawInterval);
      const img = images[index++];
      img && ctx.drawImage(img, 0, 0);
    }, 600);
    
    const saveFilePromise = new Promise<Blob>(res => {
      return recorder.onstop = () => {
        const blob = new Blob(chunks, {type: 'video/webm'});
        res(blob);
      }
    });

    await sleep(12000);
    recorder.stop();
    const videoBlob = await saveFilePromise;
    const fileURL = window.URL.createObjectURL(videoBlob);
    resultVideo.src = fileURL;
    resultVideo.play();

    // raf.delete(makeFrame);
    // const videoBlob = await saveFilePromise;
    // if (videoBlob instanceof Error) return alert('error01'); // ffmpeg 설치필요
    // const file = new File([new Blob([videoBlob], {type: 'video/mp4'})], 'video.mp4', {type: 'video/mp4', lastModified: Date.now()});
    // const file = new Blob([videoBlob], {type: 'video/mp4'});
    // const fileURL = window.URL.createObjectURL(file);
    // resultVideo.src = fileURL;
    // resultVideo.play();
  }

} catch(err: any) {
  throw new Error(err);
}}
main();

