// Lógica do Quebra-Cabeça com Imagem e Arrastar/Soltar
let puzzlePieces = [];
let puzzleSolved = false;

function startRealPuzzle() {
  gameState = { type: "quebra_cabeca", startedAt: Date.now(), acertos: 0, tentativas: 0 };
  puzzleSolved = false;
  
  // Cria as peças de 0 a 8
  puzzlePieces = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  // Embaralha
  puzzlePieces.sort(() => Math.random() - 0.5);
  
  speak("Quebra-cabeça. Arraste as peças para montar a imagem.");
  renderRealPuzzle();
}

function renderRealPuzzle() {
  const board = document.getElementById("game-board");
  
  // Imagem de exemplo (um gatinho fofo). Você pode trocar o link depois.
  const imgUrl = "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=400&fit=crop";
  
  let html = `
    <div style="text-align:center; margin-bottom:15px;">
      <h3>Arraste as peças para montar a imagem</h3>
      <button class="btn btn-outline btn-sm" onclick="startRealPuzzle()" style="margin-top:5px;">Embaralhar Novamente</button>
    </div>
    <div class="puzzle-grid" id="puzzle-board">
  `;
  
  puzzlePieces.forEach((pieceIndex, currentIndex) => {
    const row = Math.floor(pieceIndex / 3);
    const col = pieceIndex % 3;
    const bgPos = \`-\${col * 100}px -\${row * 100}px\`;
    
    html += \`
      <div class="puzzle-piece" 
           draggable="true" 
           data-index="\${currentIndex}"
           ondragstart="dragStart(event)" 
           ondragover="dragOver(event)" 
           ondrop="dropPiece(event)"
           style="background-image: url('\${imgUrl}'); background-position: \${bgPos}; background-size: 300px 300px;">
      </div>
    \`;
  });
  
  html += \`</div>\`;
  board.innerHTML = html;
}

function dragStart(e) {
  e.dataTransfer.setData("text/plain", e.target.getAttribute("data-index"));
  e.target.classList.add("dragging");
}

function dragOver(e) {
  e.preventDefault();
}

async function dropPiece(e) {
  e.preventDefault();
  const draggedIndex = parseInt(e.dataTransfer.getData("text/plain"));
  const target = e.target.closest(".puzzle-piece");
  if (!target) return;
  
  const droppedIndex = parseInt(target.getAttribute("data-index"));
  
  if (draggedIndex !== droppedIndex) {
    // Troca as peças no array
    const temp = puzzlePieces[draggedIndex];
    puzzlePieces[draggedIndex] = puzzlePieces[droppedIndex];
    puzzlePieces[droppedIndex] = temp;
    
    gameState.tentativas++;
    document.querySelector(".dragging")?.classList.remove("dragging");
    renderRealPuzzle();
    checkPuzzleSolved();
  }
}

async function checkPuzzleSolved() {
  if (puzzleSolved) return;
  const isSolved = puzzlePieces.every((val, index) => val === index);
  
  if (isSolved) {
    puzzleSolved = true;
    const dur = Math.max(1, Math.round((Date.now() - gameState.startedAt) / 1000));
    speak("Parabéns! Você montou o quebra-cabeça!");
    showAppAlert("Quebra-cabeça montado com sucesso!");
    
    // Salva no banco de dados
    await recordGameSession("Quebra-Cabeça (Imagem)", 9, gameState.tentativas, dur);
  }
}
