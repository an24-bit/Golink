const askBtn = document.getElementById("askBtn");
const input = document.getElementById("question");
const responseBox = document.getElementById("responseBox");
const speakBtn = document.getElementById("speakBtn");
const audioBox = document.getElementById("audioBox");

askBtn.addEventListener("click", askQuestion);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") askQuestion();
});

async function askQuestion() {
  const question = input.value.trim();
  if (!question) return alert("Please type a question first.");

  responseBox.textContent = "Thinking...";
  audioBox.style.display = "none";

  try {
    const res = await fetch(`/ask?q=${encodeURIComponent(question)}`);
    const data = await res.json();

    if (data.answer) {
      responseBox.textContent = data.answer;
      audioBox.style.display = "block";
      speakBtn.onclick = () => speakText(data.answer);
    } else {
      responseBox.textContent = "No answer found.";
    }
  } catch (err) {
    console.error(err);
    responseBox.textContent = "Error: could not fetch response.";
  }
}

function speakText(text) {
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-GB";
  utterance.rate = 0.85;
  utterance.pitch = 1;
  synth.speak(utterance);
}
