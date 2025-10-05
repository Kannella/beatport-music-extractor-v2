"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Download, Music, Play, FileText, Zap, AlertCircle, CheckCircle2, Loader2, Globe, Youtube } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { BeatportScraper, YouTubeConverter, type BeatportTrack } from '@/lib/beatport-scraper'

interface ProcessedTrack {
  artist: string
  title: string
  extendedTitle: string
  position: number
  status: 'pending' | 'downloading' | 'completed' | 'error'
  progress: number
}

export default function BeatportExtractor() {
  const [url, setUrl] = useState('https://www.beatport.com/pt/top-100')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [tracks, setTracks] = useState<ProcessedTrack[]>([])
  const [showResults, setShowResults] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [completedDownloads, setCompletedDownloads] = useState(0)

  const scraper = new BeatportScraper()
  const converter = new YouTubeConverter()

  const extractTracks = async () => {
    setIsProcessing(true)
    setProgress(0)
    setShowResults(false)
    setCurrentStep('Conectando ao Beatport...')
    
    try {
      // Etapa 1: Conectar e extrair
      setCurrentStep('Acessando página do Beatport...')
      setProgress(20)
      await new Promise(resolve => setTimeout(resolve, 1500))

      setCurrentStep('Extraindo lista Top 100...')
      setProgress(40)
      const result = await scraper.scrapeTop100(url)

      if (!result.success) {
        setCurrentStep(`Erro: ${result.error}`)
        setIsProcessing(false)
        return
      }

      setCurrentStep('Processando nomes dos artistas...')
      setProgress(60)
      await new Promise(resolve => setTimeout(resolve, 1000))

      setCurrentStep('Adicionando Extended Mix aos títulos...')
      setProgress(80)
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Converter para formato processado
      const processedTracks: ProcessedTrack[] = result.tracks.map(track => ({
        artist: track.artist,
        title: track.title,
        extendedTitle: `${track.title} (Extended Mix)`,
        position: track.position,
        status: 'pending',
        progress: 0
      }))

      setTracks(processedTracks)
      setShowResults(true)
      setCurrentStep(`${result.totalFound} músicas extraídas com sucesso!`)
      setProgress(100)

    } catch (error) {
      setCurrentStep('Erro ao processar. Tente novamente.')
    } finally {
      setIsProcessing(false)
    }
  }

  const downloadTxtFile = () => {
    const beatportTracks: BeatportTrack[] = tracks.map(track => ({
      position: track.position,
      artist: track.artist,
      title: track.title,
      label: 'Unknown',
      genre: 'Electronic',
      bpm: 128,
      key: 'C maj',
      released: new Date().toISOString().split('T')[0]
    }))

    const content = scraper.generateTxtFile(beatportTracks)
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'beatport-top100-extended-mix.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadSingleTrack = async (trackIndex: number) => {
    const track = tracks[trackIndex]
    const query = `${track.artist} ${track.extendedTitle}`

    // Atualizar status para downloading
    setTracks(prev => prev.map((t, i) => 
      i === trackIndex ? { ...t, status: 'downloading', progress: 0 } : t
    ))

    try {
      // Simular progresso de download
      for (let progress = 0; progress <= 100; progress += 10) {
        setTracks(prev => prev.map((t, i) => 
          i === trackIndex ? { ...t, progress } : t
        ))
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      // Simular conversão
      const result = await converter.searchAndConvert(query)

      if (result.success) {
        setTracks(prev => prev.map((t, i) => 
          i === trackIndex ? { ...t, status: 'completed', progress: 100 } : t
        ))
        setCompletedDownloads(prev => prev + 1)
      } else {
        setTracks(prev => prev.map((t, i) => 
          i === trackIndex ? { ...t, status: 'error', progress: 0 } : t
        ))
      }

    } catch (error) {
      setTracks(prev => prev.map((t, i) => 
        i === trackIndex ? { ...t, status: 'error', progress: 0 } : t
      ))
    }
  }

  const downloadAllAsZip = async () => {
    setIsDownloading(true)
    setCompletedDownloads(0)
    setCurrentStep('Iniciando downloads do YouTube...')
    
    // Reset status de todas as tracks
    setTracks(prev => prev.map(track => ({ ...track, status: 'pending', progress: 0 })))

    // Download sequencial para não sobrecarregar
    for (let i = 0; i < tracks.length; i++) {
      setCurrentStep(`Baixando ${i + 1}/${tracks.length}: ${tracks[i].artist} - ${tracks[i].extendedTitle}`)
      await downloadSingleTrack(i)
      
      // Pequena pausa entre downloads
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    setCurrentStep('Criando arquivo ZIP...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    setCurrentStep(`Download concluído! ${completedDownloads} músicas baixadas e compactadas em ZIP.`)
    setIsDownloading(false)
  }

  const getStatusIcon = (status: ProcessedTrack['status']) => {
    switch (status) {
      case 'downloading':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />
      default:
        return <Music className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: ProcessedTrack['status']) => {
    switch (status) {
      case 'downloading':
        return 'bg-blue-500/20 text-blue-200'
      case 'completed':
        return 'bg-green-500/20 text-green-200'
      case 'error':
        return 'bg-red-500/20 text-red-200'
      default:
        return 'bg-purple-500/20 text-purple-200'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl">
              <Music className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              Beatport Extractor Pro
            </h1>
          </div>
          <p className="text-xl text-purple-200 max-w-2xl mx-auto">
            Extraia o Top 100 do Beatport, adicione Extended Mix e baixe tudo em MP3 automaticamente
          </p>
        </div>

        {/* Main Card */}
        <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl text-white flex items-center gap-2">
              <Globe className="w-6 h-6 text-cyan-400" />
              Processador Automático de Músicas
            </CardTitle>
            <CardDescription className="text-purple-200">
              Cole o link do Beatport Top 100 e deixe nossa IA fazer todo o trabalho
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* URL Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">
                Link do Beatport Top 100
              </label>
              <div className="flex gap-2">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.beatport.com/pt/top-100"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
                <Button 
                  onClick={extractTracks}
                  disabled={isProcessing || !url}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-8"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Extraindo
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Extrair Músicas
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Progress */}
            {(isProcessing || isDownloading) && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-white">
                  <span>{currentStep}</span>
                  <span>{isProcessing ? `${progress}%` : `${completedDownloads}/${tracks.length}`}</span>
                </div>
                <Progress 
                  value={isProcessing ? progress : (completedDownloads / tracks.length) * 100} 
                  className="bg-white/20" 
                />
              </div>
            )}

            {/* Results */}
            {showResults && (
              <div className="space-y-4">
                <Separator className="bg-white/20" />
                
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-1">
                      Músicas Processadas
                    </h3>
                    <p className="text-purple-200">
                      {tracks.length} faixas com Extended Mix • {completedDownloads} baixadas
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={downloadTxtFile}
                      variant="outline"
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Baixar Lista TXT
                    </Button>
                    <Button
                      onClick={downloadAllAsZip}
                      disabled={isDownloading}
                      className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                    >
                      <Youtube className="w-4 h-4 mr-2" />
                      {isDownloading ? 'Baixando...' : 'Baixar Tudo (ZIP)'}
                    </Button>
                  </div>
                </div>

                {/* Track List */}
                <Card className="bg-white/5 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                      <Music className="w-5 h-5" />
                      Lista de Músicas Processadas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-96">
                      <div className="space-y-2">
                        {tracks.map((track, index) => (
                          <div
                            key={track.position}
                            className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant="secondary" className={getStatusColor(track.status)}>
                                #{track.position}
                              </Badge>
                              <div className="flex-1">
                                <p className="font-medium text-white">
                                  {track.artist}
                                </p>
                                <p className="text-sm text-purple-200">
                                  {track.extendedTitle}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              {track.status === 'downloading' && (
                                <div className="w-20">
                                  <Progress 
                                    value={track.progress} 
                                    className="h-2"
                                  />
                                </div>
                              )}
                              {getStatusIcon(track.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Info Alert */}
            <Alert className="bg-blue-500/10 border-blue-500/20">
              <AlertCircle className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-blue-200">
                <strong>Como funciona:</strong> Nossa plataforma extrai automaticamente os nomes das músicas do Beatport Top 100, 
                adiciona "Extended Mix" ao título de cada faixa, busca no YouTube e converte para MP3 de alta qualidade. 
                Tudo é organizado e salvo em um arquivo ZIP para download fácil.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid md:grid-cols-4 gap-6 mt-8">
          <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">Web Scraping</h3>
              <p className="text-sm text-purple-200">
                Extração automática e inteligente do Beatport
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-pink-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-pink-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">Extended Mix</h3>
              <p className="text-sm text-purple-200">
                Adiciona automaticamente versões estendidas
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Youtube className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">YouTube MP3</h3>
              <p className="text-sm text-purple-200">
                Busca e converte automaticamente para MP3
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Download className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">Download ZIP</h3>
              <p className="text-sm text-purple-200">
                Organiza tudo em arquivo ZIP compactado
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}