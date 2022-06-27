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
  // console.log(devices, videoDevice)
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

const WEBCAM_NAME = 'PLEOMAX' //'C922';
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
  
  const imageStore: Blob[] = [];

  // const startBtn = document.getElementById('start') as HTMLButtonElement;
  // const stopBtn = document.getElementById('stop') as HTMLButtonElement;
  const recordBtn = document.getElementById('record') as HTMLButtonElement;
  const recordStop = document.getElementById('record-stop') as HTMLButtonElement;
  const playButton = document.getElementById('play') as HTMLButtonElement;
  const resultVideo = document.getElementById("video") as HTMLVideoElement;

  // startBtn.onclick = async () => { }
  // stopBtn.onclick = () => { }
  
  let mediaRecorder: MediaRecorder;
  const recordedBlobs: Blob[] = [];
  recordBtn.onclick = async () => {
    mediaRecorder = new MediaRecorder(stream, {mimeType: 'video/webm'});
    mediaRecorder.ondataavailable = ({data}) => recordedBlobs.push(data);
    mediaRecorder.start();
  }

  recordStop.onclick = () => {
    mediaRecorder.stop();
  }

  playButton.onclick = () => {
    const blob = new Blob(recordedBlobs, {type: 'video/webm'});
    const url = window.URL.createObjectURL(blob);
    resultVideo.width = 800;
    resultVideo.height = 800;
    resultVideo.style.objectFit = 'fill';
    resultVideo.src = url;
    resultVideo.play();
  }

} catch(err: any) {
  throw new Error(err);
}}
main();

