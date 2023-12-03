import React, { useEffect, useCallback, useState } from "react";
import ReactPlayer from "react-player";
import peer from "../service/peer";
import { useSocket } from "../context/SocketProvider";
import "./RoomScreen.css";

const RoomPage = () => {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`Email ${email} joined room`);
    setRemoteSocketId(id);
  }, []);

  const handleCallUser = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      const offer = await peer.getOffer();
      socket.emit("user:call", { to: remoteSocketId, offer });
      setMyStream(stream);
    } catch (error) {
      console.error("Error getting user media:", error);
    }
  }, [remoteSocketId, socket]);

  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      try {
        setRemoteSocketId(from);
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        setMyStream(stream);
        console.log(`Incoming Call`, from, offer);
        const ans = await peer.getAnswer(offer);
        socket.emit("call:accepted", { to: from, ans });
      } catch (error) {
        console.error("Error handling incoming call:", error);
      }
    },
    [socket]
  );

  const sendStreams = useCallback(() => {
    if (myStream) {
      for (const track of myStream.getTracks()) {
        peer.peer.addTrack(track, myStream);
      }
    }
  }, [myStream]);

  const handleCallAccepted = useCallback(
    ({ ans }) => {
      try {
        peer.setLocalDescription(ans);
        console.log("Call Accepted!");
        sendStreams();
      } catch (error) {
        console.error("Error handling call accepted:", error);
      }
    },
    [sendStreams]
  );

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", async () => {
      try {
        const offer = await peer.getOffer();
        socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
      } catch (error) {
        console.error("Error handling negotiation needed:", error);
      }
    });
    return () => {
      peer.peer.removeEventListener("negotiationneeded", () => {});
    };
  }, [remoteSocketId, socket]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      try {
        const ans = await peer.getAnswer(offer);
        socket.emit("peer:nego:done", { to: from, ans });
      } catch (error) {
        console.error("Error handling incoming negotiation:", error);
      }
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(
    async ({ ans }) => {
      try {
        await peer.setLocalDescription(ans);
      } catch (error) {
        console.error("Error handling final negotiation:", error);
      }
    },
    []
  );

  useEffect(() => {
    peer.peer.addEventListener("track", async (ev) => {
      const remoteStream = ev.streams;
      console.log("GOT TRACKS!!");
      setRemoteStream(remoteStream[0]);
    });
  }, []);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
  ]);

  return (
    <div>
      <h1>Room Page</h1>
      <h4>{remoteSocketId ? "Connected" : "No one in room"}</h4>
      {myStream && <button onClick={sendStreams}>Send Stream</button>}
      {remoteSocketId && <button onClick={handleCallUser}>CALL</button>}
      {myStream && (
        <>
          <h1>My Stream</h1>
          <ReactPlayer
            playing
            muted
            height="100px"
            width="200px"
            url={myStream}  
          />
        </>
      )}
      {remoteStream && (
        <>
          <h1>Remote Stream</h1>
          <ReactPlayer
            playing
            muted
            height="100px"
            width="200px"
            url={remoteStream}  
          />
        </>
      )}
    </div>
  );
};

export default RoomPage;
