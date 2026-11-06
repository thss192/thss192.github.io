// 开屏贪吃蛇 AI 演示浮窗 (完美还原 C++ 思路版)
(function () {
  if (document.getElementById("splash-overlay")) return;

  const overlayHtml = `
    <div id="splash-overlay">
      <div class="snake-terminal">
        <div class="terminal-header">
          <div class="terminal-dots"><span></span><span></span><span></span></div>
          <span>snake_ai_agent.exe</span>
          <span>15x20 Grid</span>
        </div>
        <div id="snake-grid"></div>
        <div class="terminal-footer">
          <div>Score: <span id="snake-score">0</span></div>
          <div>Length: <span id="snake-len">3</span></div>
          <div>Status: <span id="snake-status">BFS Searching...</span></div>
        </div>
        <button id="speed-btn" class="splash-speed-btn">点我加速 x1.0</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", overlayHtml);

  const gridEl = document.getElementById("snake-grid");
  const scoreEl = document.getElementById("snake-score");
  const lenEl = document.getElementById("snake-len");
  const statusEl = document.getElementById("snake-status");
  const speedBtn = document.getElementById("speed-btn");

  const COLS = 20;
  const ROWS = 15;
  const TOTAL_CELLS = COLS * ROWS;
  
  let gridCells = [];
  let snake = [];
  let food = { x: 0, y: 0 };
  let score = 0;
  
  let gameInterval = null;
  let currentSpeed = 1.0; 
  let baseInterval = 80; 
  let maxSteps = 5000;
  let stepCount = 0;

  function initGridDOM() {
    gridEl.innerHTML = "";
    gridCells = [];
    for (let y = 0; y < ROWS; y++) {
      let rowCells = [];
      for (let x = 0; x < COLS; x++) {
        const cell = document.createElement("div");
        cell.className = "snake-cell";
        gridEl.appendChild(cell);
        rowCells.push(cell);
      }
      gridCells.push(rowCells);
    }
  }

  function render() {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        gridCells[y][x].className = "snake-cell";
      }
    }
    gridCells[food.y][food.x].classList.add("snake-food");
    snake.forEach((segment, index) => {
      if (index === 0) {
        gridCells[segment.y][segment.x].classList.add("snake-body", "snake-head");
      } else {
        gridCells[segment.y][segment.x].classList.add("snake-body");
      }
    });
    scoreEl.textContent = score;
    lenEl.textContent = snake.length;
  }

  function generateFood() {
    while (true) {
      const fx = Math.floor(Math.random() * COLS);
      const fy = Math.floor(Math.random() * ROWS);
      if (!snake.some(s => s.x === fx && s.y === fy)) {
        food = { x: fx, y: fy };
        break;
      }
    }
  }

  function initGame() {
    snake = [{ x: 5, y: 7 }, { x: 4, y: 7 }, { x: 3, y: 7 }];
    score = 0;
    stepCount = 0;
    generateFood();
    render();
    statusEl.textContent = "Scoring...";
  }

  // ==========================================
  // 核心 BFS 漫延算法（完美复刻 C++ 思路）
  // ==========================================
  function bfsDistance(startX, startY, targetX, targetY, initialSnake, isTargetFood) {
    let matrix = Array.from({ length: ROWS }, () => new Array(COLS).fill(-1));
    let queue = [{ x: startX, y: startY }];
    matrix[startY][startX] = 0;
    const dirs = [{x:0,y:-1}, {x:0,y:1}, {x:-1,y:0}, {x:1,y:0}];

    while (queue.length > 0) {
      const cur = queue.shift();
      const currentStep = matrix[cur.y][cur.x];

      if (cur.x === targetX && cur.y === targetY) {
        return currentStep;
      }

      for (const dir of dirs) {
        const nx = cur.x + dir.x;
        const ny = cur.y + dir.y;

        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
        if (matrix[ny][nx] !== -1) continue;

        // 核心：判断这一步是否被身体挡住
        let isBlocked = false;
        for (let i = 0; i < initialSnake.length; i++) {
          const seg = initialSnake[i];
          if (seg.x === nx && seg.y === ny) {
            // 【时间魔法】：如果是尾巴(i === len - 1)，且当前步数已经超过了尾巴移动的步数，尾巴就已经空出来了
            if (i === initialSnake.length - 1) {
              const tailDelay = initialSnake.length; // 尾巴需要移动多少步才离开这个位置
              if (currentStep + 1 >= tailDelay) {
                continue; // 已经走开了，允许通行
              }
            }
            isBlocked = true;
            break;
          }
        }

        if (isBlocked) continue;

        matrix[ny][nx] = currentStep + 1;
        queue.push({ x: nx, y: ny });
      }
    }
    return null;
  }

  // 核心打分与决策
  function getNextMove() {
    const head = snake[0];
    const tail = snake[snake.length - 1];
    const dirs = [{x:0,y:-1}, {x:0,y:1}, {x:-1,y:0}, {x:1,y:0}];
    
    let bestDirection = null;
    let maxScore = -Infinity;

    for (const dir of dirs) {
      const nx = head.x + dir.x;
      const ny = head.y + dir.y;

      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;

      // 预判第一步撞墙/撞身体
      let isBlockedNow = false;
      for (let i = 0; i < snake.length; i++) {
        if (snake[i].x === nx && snake[i].y === ny) {
          if (i === snake.length - 1 && !(nx === food.x && ny === food.y)) {
            continue;
          }
          isBlockedNow = true;
          break;
        }
      }
      if (isBlockedNow) continue;

      let score = 0;

      // 1. 尝试寻找食物
      const distToFood = bfsDistance(nx, ny, food.x, food.y, snake, true);
      if (distToFood !== null) {
        // 找到食物，距离越近得分越高
        score += 10 + (1 / (distToFood + 1));
      } else {
        score += 0;
      }

      // 2. 寻尾兜底
      // 模拟走完一步后的尾巴位置
      const simSnake = (nx === food.x && ny === food.y) 
        ? [{x:nx,y:ny}, ...snake] 
        : [{x:nx,y:ny}, ...snake.slice(0,-1)];
      const simTail = simSnake[simSnake.length - 1];

      const distToTail = bfsDistance(nx, ny, simTail.x, simTail.y, simSnake, false);
      if (distToTail !== null) {
        score += 1;
      } else {
        score *= -1;
      }

      if (score > maxScore) {
        maxScore = score;
        bestDirection = { x: nx, y: ny, score, isEating: (nx === food.x && ny === food.y) };
      }
    }

    if (bestDirection) {
      if (bestDirection.isEating) statusEl.textContent = "Target: Food 🍎";
      else if (maxScore > 5) statusEl.textContent = "Target: Approach Food 👀";
      else statusEl.textContent = "Target: Safe Space 🐍";
      return bestDirection;
    }

    statusEl.textContent = "Dead End ⚠️";
    return null;
  }

  function gameLoop() {
    if (snake.length === 0) return;

    stepCount++;
    if (stepCount > maxSteps) {
      endGame("Demo Timeout");
      return;
    }

    const nextMove = getNextMove();

    if (!nextMove) {
      endGame("Fully Blocked");
      return;
    }

    snake.unshift({ x: nextMove.x, y: nextMove.y });
    if (nextMove.isEating) {
      score += 10;
      if (snake.length >= TOTAL_CELLS) {
        endGame("Perfect! Screen Filled 🎉");
        return;
      }
      generateFood();
    } else {
      snake.pop();
    }

    render();
  }

  function updateSpeed(multiplier) {
    currentSpeed = multiplier;
    const newInterval = Math.max(20, Math.floor(baseInterval / currentSpeed));
    
    clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, newInterval);
    
    speedBtn.textContent = `点我加速 x${currentSpeed.toFixed(1)}`;
    
    const scale = Math.min(2.5, currentSpeed);
    speedBtn.style.setProperty("--btn-scale", scale);
    speedBtn.style.animation = "none"; 
    speedBtn.style.transform = `scale(${scale})`;
  }

  function endGame(reason) {
    clearInterval(gameInterval);
    statusEl.textContent = reason;
    speedBtn.disabled = true;
    
    setTimeout(() => {
      const overlay = document.getElementById("splash-overlay");
      if (overlay) {
        overlay.classList.add("is-hidden");
        setTimeout(() => overlay.remove(), 800);
      }
    }, 2000);
  }

  speedBtn.addEventListener("click", () => {
    if (currentSpeed >= 10.0) return;
    let newSpeed = currentSpeed * 1.15;
    updateSpeed(newSpeed);
  });

  if (window.location.pathname.includes("about")) {
    initGridDOM();
    initGame();
    updateSpeed(1.0);
  }

})();