> verifica e spiega solo come mai l'ambiente completo si toglie      
sempre 
  ⎿  No server running

● claude-visual-studio - backend_get_logs (MCP)(limit: 50, filter:   
                                               "stderr")
  ⎿ No backend logs captured. Start a dev server first with back     
    end_start_dev_server.


● Bash(netstat -ano | findstr ":3000 :3001" | findstr LISTENING)     
  ⎿   TCP    0.0.0.0:3000           0.0.0.0:0              LISTE     
    NING       59428
      TCP    0.0.0.0:3001           0.0.0.0:0              LISTE     
    … +5 lines (ctrl+o to expand)



● Ecco il problema:

  I server SONO attivi (porte 3000/3001 in ascolto), ma l'estensione dice "No server running".

  Causa tecnica:

  pnpm dev → spawna turbo → spawna next dev (node.exe)
     ↓
  PID padre termina subito
     ↓
  Estensione perde il tracking
     ↓
  "No server running" (falso)

  Cosa succede:

  1. backend_start_dev_server lancia pnpm dev
  2. pnpm lancia turbo come processo figlio
  3. turbo lancia next dev (node.exe) come sotto-processo
  4. Il PID iniziale di pnpm termina dopo ~2-3 secondi
  5. L'estensione tracciava solo quel PID → pensa che sia tutto morto
  6. I processi node.exe (next dev) continuano a girare ma orfani    

  Conseguenze:

  - backend_get_status → "No server running" (falso positivo)        
  - backend_get_logs → perde la connessione allo stdout
  - backend_stop_dev_server → non termina i processi reali
  - Il Visual Preview panel potrebbe chiudersi pensando che non ci sia nulla

  Soluzione per l'estensione:

  L'estensione dovrebbe:
  1. Tracciare i processi figli sulle porte specifiche (3000/3001)   
  2. Usare un process group per gestire l'intero albero
  3. Monitorare le porte invece del singolo PID