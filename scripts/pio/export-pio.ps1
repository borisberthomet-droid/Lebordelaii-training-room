# export-pio.ps1
# Parcourt un arbre PioSOLVER sauvegarde (.cfr) et recopie, pour chaque noeud de decision, la
# strategie et les ranges des deux joueurs dans un fichier texte brut, compresse en .zip.
# Aucun calcul ici : la conversion en spots d'exercice se fait ensuite, cote site
# (scripts/pio/ dans le depot find-it), ou elle peut etre testee et verifiee.
#
# Fichier volontairement en ASCII pur : PowerShell 5.1 lit mal un script UTF-8 sans BOM, et un
# accent mal decode peut casser une chaine.
#
# Usage (dans cmd, sur le serveur ou Pio est installe) :
#   powershell -ExecutionPolicy Bypass -File C:\PioSOLVER\export-pio.ps1 -Arbre C:\chemin\sim.cfr -Runouts "As Kd;7c 9h"
#
# Parametres :
#   -Arbre      chemin du .cfr (sans espace)
#   -Runouts    runouts a exporter, separes par des ";" : "turn river" ou "turn" seule
#   -SansRiver  ne descend pas aux rivers (arbre sauvegarde sans rivers)
#   -MaxNoeuds  arret apres N noeuds de decision, pour un essai
#   -Pio        chemin de PioSOLVER2-pro.exe (defaut C:\PioSOLVER\PioSOLVER2-pro.exe)
#   -Dossier    dossier de sortie (defaut C:\PioSOLVER\exports)

param(
  [Parameter(Mandatory = $true)][string]$Arbre,
  [Parameter(Mandatory = $true)][string]$Runouts,
  [string]$Pio = "C:\PioSOLVER\PioSOLVER2-pro.exe",
  [string]$Dossier = "C:\PioSOLVER\exports",
  [switch]$SansRiver,
  [int]$MaxNoeuds = 0
)
$ErrorActionPreference = "Stop"
$sansVide = [System.StringSplitOptions]::RemoveEmptyEntries

# --- Runouts demandes ---------------------------------------------------------------------------
# Un arbre complet contient toutes les turns et toutes les rivers : on ne suit que celles demandees,
# sinon l'export pese des dizaines de Go.
$turns = @{}
foreach ($runout in $Runouts.Split(';')) {
  $cartes = @($runout.Trim().Split(' ', $sansVide))
  if ($cartes.Count -lt 1 -or $cartes.Count -gt 2) { throw "Runout invalide : '$runout' (attendu 'As Kd' ou 'As')" }
  foreach ($c in $cartes) {
    if ($c -cnotmatch '^[2-9TJQKA][shdc]$') { throw "Carte invalide : '$c' (exemples : As, Td, 9c)" }
  }
  if (-not $turns.ContainsKey($cartes[0])) { $turns[$cartes[0]] = New-Object System.Collections.Generic.List[string] }
  if ($cartes.Count -eq 2) { $turns[$cartes[0]].Add($cartes[1]) }
}

if (-not (Test-Path $Arbre)) { throw "Arbre introuvable : $Arbre" }
if (-not (Test-Path $Pio)) { throw "PioSOLVER introuvable : $Pio" }

# --- Dialogue avec Pio ----------------------------------------------------------------------------
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $Pio
$psi.WorkingDirectory = Split-Path -Parent $Pio
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.CreateNoWindow = $true
$solveur = [System.Diagnostics.Process]::Start($psi)

# Chaque reponse de Pio se termine par la ligne FIN (voir set_end_string plus bas).
function Envoyer([string]$commande) {
  $solveur.StandardInput.WriteLine($commande)
  $solveur.StandardInput.Flush()
  $lignes = New-Object System.Collections.Generic.List[string]
  while ($true) {
    $ligne = $solveur.StandardOutput.ReadLine()
    if ($null -eq $ligne) { throw "Pio s'est arrete pendant : $commande" }
    if ($ligne.Trim() -eq 'FIN') { break }
    $lignes.Add($ligne)
  }
  if ($lignes.Count -gt 0 -and $lignes[0].StartsWith('ERROR')) { throw "Pio refuse '$commande' : $($lignes[0])" }
  return ,$lignes
}

# Bloc de noeud (show_node, show_children) : id, type, board, mises "OOP IP pot", "N children", flags.
function Lire-Noeuds($lignes) {
  $noeuds = New-Object System.Collections.Generic.List[object]
  for ($i = 0; $i -lt $lignes.Count; $i++) {
    if ($lignes[$i] -match '^r:\S*\s*$') {
      $noeuds.Add([pscustomobject]@{
        Id      = $lignes[$i].Trim()
        Type    = $lignes[$i + 1].Trim()
        Board   = $lignes[$i + 2].Trim()
        Mises   = $lignes[$i + 3].Trim()
        Enfants = [int]($lignes[$i + 4].Trim().Split(' ', $sansVide)[0])
        Flags   = $lignes[$i + 5].Trim()
      })
      $i += 5
    }
  }
  return ,$noeuds
}

New-Item -ItemType Directory -Force -Path $Dossier | Out-Null
# Pio nomme le .cfr d'apres le board seul : le scenario (positions, profondeur) vient du dossier
# qui le contient. On l'ajoute au nom de l'export, sinon deux scenarios du meme board s'ecrasent.
$scenario = Split-Path -Leaf (Split-Path -Parent (Resolve-Path $Arbre).Path)
$nom = "{0}_{1}" -f $scenario, [System.IO.Path]::GetFileNameWithoutExtension($Arbre)
$fichier = Join-Path $Dossier "$nom.txt"
$zip = Join-Path $Dossier "$nom.zip"
$ecrivain = New-Object System.IO.StreamWriter($fichier, $false, (New-Object System.Text.UTF8Encoding($false)))

function Ecrire([string]$titre, $lignes) {
  $ecrivain.WriteLine("### $titre")
  foreach ($l in $lignes) { $ecrivain.WriteLine($l) }
}

$chrono = [System.Diagnostics.Stopwatch]::StartNew()
$decisions = 0
try {
  Envoyer 'set_end_string FIN' | Out-Null
  Write-Host "Chargement de l'arbre (peut prendre plusieurs minutes)..."
  Envoyer "load_tree $Arbre" | Out-Null
  Write-Host ("Arbre charge en {0:N0} s" -f $chrono.Elapsed.TotalSeconds)

  Ecrire 'EXPORT' @("arbre=$Arbre", "runouts=$Runouts", "sans_river=$($SansRiver.IsPresent)", "date=$(Get-Date -Format s)")
  Ecrire 'TREE_INFO' (Envoyer 'show_tree_info')
  Ecrire 'HAND_ORDER' (Envoyer 'show_hand_order')

  # Parcours en profondeur. Les enfants sont empiles a l'envers pour etre visites dans l'ordre de Pio.
  $pile = New-Object System.Collections.Generic.Stack[object]
  $pile.Push((Lire-Noeuds (Envoyer 'show_node r:0'))[0])

  while ($pile.Count -gt 0) {
    $n = $pile.Pop()
    Ecrire "NODE $($n.Id)" @($n.Type, $n.Board, $n.Mises, "$($n.Enfants) children", $n.Flags)

    if ($n.Type -eq 'OOP_DEC' -or $n.Type -eq 'IP_DEC') {
      Ecrire "STRATEGY $($n.Id)" (Envoyer "show_strategy $($n.Id)")
      Ecrire "RANGE_OOP $($n.Id)" (Envoyer "show_range OOP $($n.Id)")
      Ecrire "RANGE_IP $($n.Id)" (Envoyer "show_range IP $($n.Id)")
      $decisions++
      if ($decisions % 50 -eq 0) {
        Write-Host ("{0} noeuds de decision exportes ({1:N0} s)" -f $decisions, $chrono.Elapsed.TotalSeconds)
      }
      if ($MaxNoeuds -gt 0 -and $decisions -ge $MaxNoeuds) { Write-Host "Limite -MaxNoeuds atteinte."; break }
    }
    if ($n.Enfants -eq 0) { continue }

    $enfants = Lire-Noeuds (Envoyer "show_children $($n.Id)")
    $board = @($n.Board.Split(' ', $sansVide))
    for ($k = $enfants.Count - 1; $k -ge 0; $k--) {
      $e = $enfants[$k]
      if ($n.Type -eq 'SPLIT_NODE') {
        $tombee = @($e.Board.Split(' ', $sansVide))[-1]
        if ($board.Count -eq 3) {
          if (-not $turns.ContainsKey($tombee)) { continue }
        } elseif ($board.Count -eq 4) {
          if ($SansRiver -or -not $turns[$board[3]].Contains($tombee)) { continue }
        } else {
          continue
        }
      }
      $pile.Push($e)
    }
  }
}
finally {
  $ecrivain.Close()
  if (-not $solveur.HasExited) {
    $solveur.StandardInput.WriteLine('exit')
    $solveur.StandardInput.Flush()
    if (-not $solveur.WaitForExit(15000)) { $solveur.Kill() }
  }
}

Compress-Archive -Path $fichier -DestinationPath $zip -Force
$taille = (Get-Item $zip).Length / 1MB
Write-Host ("Termine : {0} noeuds de decision en {1:N0} s" -f $decisions, $chrono.Elapsed.TotalSeconds)
Write-Host ("Fichier a envoyer : {0} ({1:N1} Mo)" -f $zip, $taille)
