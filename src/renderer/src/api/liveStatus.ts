// Whether live updates are flowing; while they are, mail queries stop polling.
let live = false;

export const setLive = (connected: boolean) => {
  live = connected;
};

export const isLive = () => live;
