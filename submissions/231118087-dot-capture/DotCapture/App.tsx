import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Animated, Alert, Modal,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import AuditWidget from './AuditWidget';

type Phase = 'input' | 'questioning' | 'spec' | 'expert';
type Persona = 'junior' | 'senior' | 'expert';
interface QA { question: string; answer: string; }
interface ChatMessage { role: 'user' | 'assistant'; content: string; isStuckAlert?: boolean; }

// ─── HuggingFace API ──────────────────────────────────────────────────────────
const HF_TOKEN = process.env.HF_TOKEN;
const HF_MODEL = "mistralai/Mistral-7B-Instruct-v0.3";
const HF_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

async function callAI(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  try {
    const filtered = messages.filter(m => !m.isStuckAlert);
    let prompt = `<s>[INST] ${systemPrompt}\n\n`;
    filtered.forEach((m, i) => {
      if (m.role === 'user') {
        prompt += i === 0 ? `${m.content} [/INST]` : ` [INST] ${m.content} [/INST]`;
      } else {
        prompt += ` ${m.content} </s>`;
      }
    });
    const response = await fetch(HF_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 400, temperature: 0.7, return_full_text: false, do_sample: true },
        options: { wait_for_model: true, use_cache: false },
      }),
    });
    if (!response.ok) {
      const err = await response.json();
      if (err?.error?.includes('loading')) throw new Error('Model yükleniyor, 20 saniye bekleyip tekrar deneyin.');
      throw new Error(err?.error || 'API Hatası: ' + response.status);
    }
    const data = await response.json();
    let text = data[0]?.generated_text?.trim() ?? '';
    if (text.includes('[/INST]')) text = text.split('[/INST]').pop()?.trim() ?? text;
    return text || 'Yanıt alınamadı, tekrar deneyin.';
  } catch (error: any) {
    throw error;
  }
}

// ─── Sabitler ─────────────────────────────────────────────────────────────────
const STUCK_KEYWORDS = ['bilmiyorum', 'emin değilim', 'yok', 'hiç', 'olmaz', 'fikrim yok', 'bilmem'];
const isStuck = (text: string): boolean =>
  text.trim().length < 20 || STUCK_KEYWORDS.some(k => text.toLowerCase().includes(k));

const saveBridge = async (messages: ChatMessage[], idea: string): Promise<void> => {
  try {
    const transcript = messages
      .filter(m => !m.isStuckAlert)
      .map(m => `[${m.role === 'user' ? 'KULLANICI' : 'UZMAN'}] ${m.content}`)
      .join('\n\n');
    const content = `# BRIDGE — ${new Date().toLocaleDateString('tr-TR')}\n\n**Fikir:** ${idea}\n\n${transcript}`;
    await AsyncStorage.setItem('BRIDGE_latest', content);
  } catch (e) { console.warn('BRIDGE kayıt hatası:', e); }
};

const PERSONAS: Record<Persona, {
  label: string; emoji: string; icon: string; tone: string;
  greeting: string; badge: string; color: string;
}> = {
  junior: {
    label: 'Junior', emoji: '🧑', icon: 'AY', badge: 'Junior AI',
    color: '#4caf50',
    tone: 'Sen Ahmet Yılmaz, samimi ve enerjik bir girişim danışmanısın. Emoji kullan. Kısa ve anlaşılır Türkçe cevaplar ver. Maksimum 3 cümle.',
    greeting: 'Selam! Ben Ahmet Yılmaz, girişim danışmanın 🚀 Fikrin hakkında her şeyi konuşabiliriz!',
  },
  senior: {
    label: 'Senior', emoji: '👔', icon: 'SK', badge: 'Senior AI',
    color: '#1565c0',
    tone: 'Sen Selin Kaya, profesyonel ve analitik bir strateji uzmanısın. Veriye dayalı, özlü Türkçe cevaplar ver. Maksimum 3 cümle.',
    greeting: 'Merhaba. Ben Selin Kaya, strateji uzmanınım. Fikrinizi analitik açıdan değerlendireceğim.',
  },
  expert: {
    label: 'Expert', emoji: '🎓', icon: 'KA', badge: 'Expert AI',
    color: '#6a1b9a',
    tone: 'Sen Dr. Kemal Arslan, akademik ve derin analitik bir uzman danışmansın. Referanslar ver, metodoloji açıkla. Türkçe konuş. Maksimum 4 cümle.',
    greeting: 'Merhaba. Ben Dr. Kemal Arslan. Kritik karar noktalarında derinlemesine analiz sunarım.',
  },
};

const QUESTION_SYSTEM = `Sen bir girişim fikri görüşmecisisin. TEK bir keskin soru sor. Odak: problem, kullanıcı, kapsam, başarı metrikleri. Kısa ol, tek cümle. Türkçe sor.`;
const SPEC_SYSTEM = `Sen bir ürün spec yazarısın. Şu bölümleri içeren kısa bir spec üret: ## Problem, ## Kullanıcı, ## Temel Özellik, ## Kapsam, ## Başarı Metriği. Türkçe yaz.`;

// ─── Mikrofon Hook ────────────────────────────────────────────────────────────
function useMicrophone() {
  const [isRecording, setIsRecording] = useState(false);
  const [rmsLevel, setRmsLevel] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { Alert.alert('İzin Gerekli', 'Mikrofon izni verilmedi.'); return; }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);

      // RMS simülasyonu — expo-av metering ile
      intervalRef.current = setInterval(async () => {
        if (!recordingRef.current) return;
        try {
          const status = await recordingRef.current.getStatusAsync();
          if (status.isRecording && status.metering !== undefined) {
            // metering: -160 (sessiz) → 0 (max). 0-1 aralığına normalize et
            const normalized = Math.max(0, (status.metering + 60) / 60);
            setRmsLevel(normalized);
          }
        } catch (_) {}
      }, 100);
    } catch (e: any) {
      Alert.alert('Hata', 'Mikrofon başlatılamadı: ' + e.message);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setRmsLevel(0);
    setIsRecording(false);
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
    } catch (_) {}
    recordingRef.current = null;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (recordingRef.current) recordingRef.current.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  return { isRecording, rmsLevel, startRecording, stopRecording };
}

// ─── RMS Sound Wave ───────────────────────────────────────────────────────────
function RMSSoundWave({ rmsLevel, isRecording, color }: {
  rmsLevel: number; isRecording: boolean; color: string;
}) {
  const BAR_COUNT = 7;
  const bars = Array.from({ length: BAR_COUNT }, (_, i) => useRef(new Animated.Value(4)).current);

  useEffect(() => {
    bars.forEach((bar, i) => {
      const center = (BAR_COUNT - 1) / 2;
      const distFromCenter = Math.abs(i - center) / center; // 0 (merkez) → 1 (kenar)
      const multiplier = isRecording ? (1 - distFromCenter * 0.4) : 0;
      const targetHeight = 4 + rmsLevel * 28 * multiplier + (isRecording ? Math.random() * 4 : 0);

      Animated.timing(bar, {
        toValue: Math.max(4, targetHeight),
        duration: 80,
        useNativeDriver: false,
      }).start();
    });
  }, [rmsLevel, isRecording]);

  return (
    <View style={styles.rmsWaveBars}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[
            styles.rmsWaveBar,
            { height: bar, backgroundColor: isRecording ? color : '#ccc' },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Mikrofon Butonu ──────────────────────────────────────────────────────────
function MicButton({ color, onChatInput }: { color: string; onChatInput: (text: string) => void }) {
  const { isRecording, rmsLevel, startRecording, stopRecording } = useMicrophone();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const handlePress = async () => {
    if (isRecording) {
      await stopRecording();
      // Ses kaydı durdu — kullanıcıya bilgi ver
      onChatInput('[Ses kaydı tamamlandı — metin dönüşümü yakında]');
    } else {
      await startRecording();
    }
  };

  return (
    <View style={styles.micContainer}>
      <RMSSoundWave rmsLevel={rmsLevel} isRecording={isRecording} color={color} />
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          style={[styles.micBtn, { backgroundColor: isRecording ? '#e53935' : color }]}
          onPress={handlePress}
        >
          <Text style={styles.micIcon}>{isRecording ? '⏹' : '🎤'}</Text>
        </TouchableOpacity>
      </Animated.View>
      <Text style={[styles.micLabel, { color: isRecording ? '#e53935' : '#aaa' }]}>
        {isRecording ? 'Kaydediliyor...' : 'Konuş'}
      </Text>
    </View>
  );
}

// ─── Expert Call Modal ────────────────────────────────────────────────────────
function ExpertCallModal({ visible, onClose, personaColor }: {
  visible: boolean; onClose: () => void; personaColor: string;
}) {
  const [callState, setCallState] = useState<'connecting' | 'connected' | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) { setCallState(null); return; }
    setCallState('connecting');
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    const t = setTimeout(() => setCallState('connected'), 2800);
    return () => { pulse.stop(); clearTimeout(t); };
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.callCard}>
          {callState === 'connecting' && (
            <>
              <Animated.View style={[styles.callPulse, { transform: [{ scale: pulseAnim }], borderColor: personaColor }]} />
              <View style={[styles.callAvatar, { backgroundColor: personaColor }]}>
                <Text style={styles.callAvatarText}>🎓</Text>
              </View>
              <Text style={styles.callName}>Dr. Kemal Arslan</Text>
              <Text style={styles.callStatus}>Uzman bağlanıyor...</Text>
              <View style={styles.callDots}>
                {[0, 1, 2].map(i => <View key={i} style={[styles.callDot, { backgroundColor: personaColor }]} />)}
              </View>
            </>
          )}
          {callState === 'connected' && (
            <>
              <View style={[styles.callAvatar, { backgroundColor: personaColor }]}>
                <Text style={styles.callAvatarText}>🎓</Text>
              </View>
              <Text style={styles.callName}>Dr. Kemal Arslan</Text>
              <Text style={[styles.callStatus, { color: '#4caf50' }]}>✓ Bağlandı</Text>
              <Text style={styles.callSubStatus}>Expert danışmanınız hazır</Text>
            </>
          )}
          <TouchableOpacity style={[styles.callCloseBtn, { backgroundColor: personaColor }]} onPress={onClose}>
            <Text style={styles.callCloseBtnText}>
              {callState === 'connected' ? 'Sohbete Geç →' : 'İptal'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── STUCK Banner ─────────────────────────────────────────────────────────────
function StuckBanner({ onEscalate }: { onEscalate: () => void }) {
  const slideAnim = useRef(new Animated.Value(-60)).current;
  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80 }).start();
  }, []);
  return (
    <Animated.View style={[styles.stuckBanner, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.stuckLeft}>
        <Text style={styles.stuckIcon}>⚠</Text>
        <View>
          <Text style={styles.stuckTitle}>Problem tespit edildi</Text>
          <Text style={styles.stuckSub}>Uzman yönlendirmesi gerekiyor</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.stuckBtn} onPress={onEscalate}>
        <Text style={styles.stuckBtnText}>Uzmanı Çağır</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── App Entry ────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
        <DotCapture />
      </View>
    </SafeAreaProvider>
  );
}

function DotCapture() {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('input');
  const [persona, setPersona] = useState<Persona>('junior');
  const [rawIdea, setRawIdea] = useState('');
  const [qas, setQas] = useState<QA[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [spec, setSpec] = useState('');
  const [loading, setLoading] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showStuck, setShowStuck] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const chatScrollRef = useRef<ScrollView>(null);
  const MAX_QUESTIONS = 4;

  const fadeTransition = (cb: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      cb();
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  };

  const handleIdeaSubmit = useCallback(async () => {
    if (!rawIdea.trim()) return;
    setLoading(true);
    try {
      const q = await callAI(QUESTION_SYSTEM, [{ role: 'user', content: `Ham fikir: "${rawIdea}". İlk soruyu sor.` }]);
      fadeTransition(() => { setCurrentQuestion(q.trim()); setPhase('questioning'); setQuestionIndex(1); });
    } catch (e: any) { Alert.alert('Hata', e.message || 'API bağlantısı başarısız.');
    } finally { setLoading(false); }
  }, [rawIdea]);

  const handleAnswerSubmit = useCallback(async () => {
    if (!currentAnswer.trim()) return;
    const newQas = [...qas, { question: currentQuestion, answer: currentAnswer }];
    setQas(newQas); setCurrentAnswer(''); setLoading(true);

    const stuckCount = newQas.filter(qa => isStuck(qa.answer)).length;
    if (stuckCount >= 2) {
      setLoading(false);
      Alert.alert('🤔 Takıldın mı?', 'Uzman danışmanla konuşmak ister misin?', [
        { text: 'Devam Et', style: 'cancel', onPress: () => setLoading(true) },
        { text: 'Uzmanı Çağır', onPress: () => openExpertChat('expert') },
      ]);
      return;
    }

    try {
      const qaText = newQas.map((qa, i) => `S${i + 1}: ${qa.question}\nC: ${qa.answer}`).join('\n\n');
      if (questionIndex >= MAX_QUESTIONS) {
        const s = await callAI(SPEC_SYSTEM, [{ role: 'user', content: `Ham fikir: "${rawIdea}"\n\nGörüşme:\n${qaText}\n\nSpec oluştur.` }]);
        fadeTransition(() => { setSpec(s.trim()); setPhase('spec'); });
      } else {
        const q = await callAI(QUESTION_SYSTEM, [{ role: 'user', content: `Ham fikir: "${rawIdea}"\n\nÖnceki cevaplar:\n${qaText}\n\n${questionIndex + 1}. soruyu sor.` }]);
        fadeTransition(() => { setCurrentQuestion(q.trim()); setQuestionIndex(i => i + 1); });
      }
    } catch (e: any) { Alert.alert('Hata', e.message || 'Bir sorun oluştu.');
    } finally { setLoading(false); }
  }, [currentAnswer, currentQuestion, qas, questionIndex, rawIdea]);

  const handleReset = () => {
    fadeTransition(() => {
      setPhase('input'); setRawIdea(''); setQas([]); setCurrentQuestion('');
      setCurrentAnswer(''); setSpec(''); setQuestionIndex(0);
      setChatMessages([]); setShowStuck(false);
    });
  };

  const openExpertChat = (selectedPersona?: Persona) => {
    const p = selectedPersona ?? persona;
    setPersona(p); setShowStuck(false);
    setChatMessages([{ role: 'assistant', content: PERSONAS[p].greeting }]);
    fadeTransition(() => setPhase('expert'));
  };

  const switchPersona = (p: Persona) => {
    setPersona(p); setShowStuck(false);
    setChatMessages([{ role: 'assistant', content: PERSONAS[p].greeting }]);
  };

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated); setChatInput(''); setChatLoading(true);

    if (isStuck(userMsg.content) && !showStuck) {
      setShowStuck(true);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠ Problem tespit edildi — Uzman yönlendirmesi gerekebilir.',
        isStuckAlert: true,
      }]);
    }

    try {
      const systemPrompt = `${PERSONAS[persona].tone}\n\nKullanıcının girişim fikri: "${rawIdea}"\nSpec özeti: ${spec || 'henüz yok'}`;
      const reply = await callAI(systemPrompt, updated);
      const finalMessages = [...updated, { role: 'assistant' as const, content: reply.trim() }];
      setChatMessages(finalMessages);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
      await saveBridge(finalMessages, rawIdea);
    } catch (e: any) { Alert.alert('Hata', e.message);
    } finally { setChatLoading(false); }
  }, [chatInput, chatMessages, chatLoading, rawIdea, spec, persona, showStuck]);

  const currentColor = PERSONAS[persona].color;

  return (
    <View style={{ flex: 1 }}>
      <ExpertCallModal
        visible={showCallModal}
        personaColor={PERSONAS['expert'].color}
        onClose={() => { setShowCallModal(false); openExpertChat('expert'); }}
      />

      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={phase === 'expert' ? chatScrollRef : undefined}
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>● nokta</Text>
            <TouchableOpacity style={styles.seedBtn} onPress={() => phase === 'expert' && setShowCallModal(true)}>
              <Text style={styles.seedIcon}>{phase === 'expert' ? '📞' : '🌱'}</Text>
            </TouchableOpacity>
          </View>

          <Animated.View style={{ opacity: fadeAnim }}>

            {/* INPUT PHASE */}
            {phase === 'input' && (
              <View>
                <Text style={styles.heroTitle}>Fikirlerini birlikte{'\n'}yeşertelim.</Text>
                <Text style={styles.heroSub}>Aklındaki tohumu buraya bırak, biz onu profesyonel bir iş planına dönüştürelim.</Text>
                <View style={styles.inputCard}>
                  <Text style={styles.inputLabel}>YENİ FİKİR GİRİŞİ</Text>
                  <TextInput
                    style={styles.ideaInput}
                    value={rawIdea}
                    onChangeText={setRawIdea}
                    placeholder="Örn: Mahalledeki atıkları toplayan bir mobil uygulama..."
                    placeholderTextColor="#aaa"
                    multiline
                  />
                </View>
                <TouchableOpacity
                  style={[styles.primaryBtn, !rawIdea.trim() && styles.btnDisabled]}
                  onPress={handleIdeaSubmit}
                  disabled={!rawIdea.trim() || loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Planı Oluştur</Text>}
                </TouchableOpacity>
                <View style={styles.secondaryRow}>
                  <TouchableOpacity style={styles.secondaryBtn}>
                    <Text style={styles.secondaryBtnText}>Toplulukla Paylaş</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryBtnGreen} onPress={() => openExpertChat()}>
                    <Text style={styles.secondaryBtnGreenText}>Uzman Görüşü Al</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.sectionTitle}>Son Taslakların</Text>
                <View style={styles.draftCard}>
                  <Text style={styles.draftIcon}>📦</Text>
                  <View>
                    <Text style={styles.draftTitle}>Lojistik Optimizasyonu</Text>
                    <Text style={styles.draftSub}>Dün · Plan Hazır</Text>
                  </View>
                </View>
              </View>
            )}

            {/* QUESTIONING PHASE */}
            {phase === 'questioning' && (
              <View>
                <Text style={styles.heroTitle}>Fikri şekillendirelim.</Text>
                <View style={styles.progressRow}>
                  {Array.from({ length: MAX_QUESTIONS }).map((_, i) => (
                    <View key={i} style={[styles.progressDot, i < questionIndex && styles.progressDotDone, i === questionIndex - 1 && styles.progressDotActive]} />
                  ))}
                </View>
                <View style={styles.inputCard}>
                  <Text style={styles.inputLabel}>SORU {questionIndex} / {MAX_QUESTIONS}</Text>
                  <Text style={styles.questionText}>{currentQuestion}</Text>
                  <TextInput
                    style={styles.ideaInput}
                    value={currentAnswer}
                    onChangeText={setCurrentAnswer}
                    placeholder="Cevabın..."
                    placeholderTextColor="#aaa"
                    multiline
                  />
                </View>
                <TouchableOpacity
                  style={[styles.primaryBtn, !currentAnswer.trim() && styles.btnDisabled]}
                  onPress={handleAnswerSubmit}
                  disabled={!currentAnswer.trim() || loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{questionIndex >= MAX_QUESTIONS ? 'Planı Oluştur' : 'Devam Et'}</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* SPEC PHASE */}
            {phase === 'spec' && (
              <View>
                <Text style={styles.heroTitle}>Plan Hazır! 🎉</Text>
                <View style={styles.specCard}>
                  <Text style={styles.specText}>{spec}</Text>
                </View>
                <TouchableOpacity style={styles.secondaryBtnGreen} onPress={() => openExpertChat()}>
                  <Text style={styles.secondaryBtnGreenText}>Uzman Görüşü Al</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 12 }]} onPress={handleReset}>
                  <Text style={styles.secondaryBtnText}>+ Yeni Fikir</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* EXPERT PHASE */}
            {phase === 'expert' && (
              <View>
                <Text style={styles.heroTitle}>Uzman Görüşü</Text>

                {showStuck && (
                  <StuckBanner onEscalate={() => { setShowCallModal(true); setShowStuck(false); }} />
                )}

                {/* Persona Switcher */}
                <View style={styles.personaRow}>
                  {(['junior', 'senior', 'expert'] as Persona[]).map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.personaBtn, persona === p && { ...styles.personaBtnActive, borderColor: PERSONAS[p].color }]}
                      onPress={() => switchPersona(p)}
                    >
                      <Text style={styles.personaEmoji}>{PERSONAS[p].emoji}</Text>
                      <Text style={[styles.personaLabel, persona === p && { color: PERSONAS[p].color }]}>{PERSONAS[p].label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Persona Badge */}
                <View style={[styles.personaBadge, { borderLeftColor: currentColor }]}>
                  <View style={[styles.personaAvatar, { backgroundColor: currentColor }]}>
                    <Text style={styles.personaAvatarText}>{PERSONAS[persona].icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personaName}>
                      {persona === 'junior' ? 'Ahmet Yılmaz' : persona === 'senior' ? 'Selin Kaya' : 'Dr. Kemal Arslan'}
                    </Text>
                    <Text style={styles.personaRole}>
                      {persona === 'junior' ? 'Girişim Danışmanı · Çevirici' : persona === 'senior' ? 'Strateji Uzmanı · Analist' : 'Akademik Danışman · Metodolog'}
                    </Text>
                  </View>
                  <View style={[styles.personaBadgePill, { backgroundColor: currentColor + '22', borderColor: currentColor }]}>
                    <Text style={[styles.personaBadgePillText, { color: currentColor }]}>{PERSONAS[persona].badge}</Text>
                  </View>
                </View>

                {/* Chat Messages */}
                {chatMessages.map((msg, i) =>
                  msg.isStuckAlert ? (
                    <View key={i} style={styles.stuckChatAlert}>
                      <Text style={styles.stuckChatAlertText}>{msg.content}</Text>
                    </View>
                  ) : (
                    <View key={i} style={[styles.chatBubble, msg.role === 'user' ? { ...styles.chatUser, backgroundColor: currentColor } : styles.chatAgent]}>
                      {msg.role === 'assistant' && (
                        <Text style={[styles.chatAgentLabel, { color: currentColor }]}>
                          {persona === 'junior' ? 'Ahmet Y.' : persona === 'senior' ? 'Selin K.' : 'Dr. Kemal A.'}
                        </Text>
                      )}
                      <Text style={[styles.chatText, msg.role === 'user' && { color: '#fff' }]}>{msg.content}</Text>
                    </View>
                  )
                )}

                {chatLoading && <ActivityIndicator color={currentColor} style={{ margin: 16 }} />}

                {/* Mikrofon + Chat Input */}
                <View style={styles.chatInputRow}>
                  <MicButton color={currentColor} onChatInput={(text) => setChatInput(text)} />
                  <TextInput
                    style={[styles.chatInput, { borderColor: currentColor + '44' }]}
                    value={chatInput}
                    onChangeText={setChatInput}
                    placeholder="Sorunuzu yazın veya 🎤 ile konuşun..."
                    placeholderTextColor="#aaa"
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.chatSendBtn, { backgroundColor: currentColor }, !chatInput.trim() && styles.btnDisabled]}
                    onPress={handleSendChat}
                    disabled={!chatInput.trim() || chatLoading}
                  >
                    <Text style={styles.chatSendText}>→</Text>
                  </TouchableOpacity>
                </View>

                {/* Expert Call Button */}
                <TouchableOpacity
                  style={[styles.callFloatBtn, { backgroundColor: PERSONAS['expert'].color }]}
                  onPress={() => setShowCallModal(true)}
                >
                  <Text style={styles.callFloatIcon}>📞</Text>
                  <Text style={styles.callFloatText}>Expert'e Bağlan</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 12 }]} onPress={() => fadeTransition(() => setPhase(spec ? 'spec' : 'input'))}>
                  <Text style={styles.secondaryBtnText}>← Geri Dön</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>

          {/* Bottom Nav */}
          <View style={styles.bottomNav}>
            <TouchableOpacity style={styles.navItem}><Text style={[styles.navText, styles.navActive]}>Ana Sayfa</Text></TouchableOpacity>
            <TouchableOpacity style={styles.navItem}><Text style={styles.navText}>Keşfet</Text></TouchableOpacity>
            <TouchableOpacity style={styles.navItem}><Text style={styles.navText}>Profil</Text></TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AuditWidget currentPhase={phase} spec={spec} idea={rawIdea} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0faf0' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  logo: { fontSize: 18, fontWeight: '800', color: '#2d6a4f' },
  seedBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 2 },
  seedIcon: { fontSize: 18 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#1a3c2a', lineHeight: 36, marginBottom: 10 },
  heroSub: { fontSize: 14, color: '#666', lineHeight: 22, marginBottom: 24 },
  inputCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 1 },
  inputLabel: { fontSize: 10, color: '#aaa', letterSpacing: 2, fontWeight: '700', marginBottom: 10 },
  ideaInput: { color: '#333', fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  primaryBtn: { backgroundColor: '#4caf50', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12, elevation: 2 },
  btnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondaryRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  secondaryBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, alignItems: 'center', elevation: 1 },
  secondaryBtnText: { color: '#555', fontWeight: '700', fontSize: 13 },
  secondaryBtnGreen: { flex: 1, backgroundColor: '#4caf50', borderRadius: 14, paddingVertical: 14, alignItems: 'center', elevation: 1 },
  secondaryBtnGreenText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1a3c2a', marginBottom: 12 },
  draftCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 14, padding: 16, elevation: 1 },
  draftIcon: { fontSize: 28 },
  draftTitle: { fontSize: 15, fontWeight: '700', color: '#333' },
  draftSub: { fontSize: 12, color: '#aaa', marginTop: 2 },
  progressRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#c8e6c9' },
  progressDotDone: { backgroundColor: '#4caf50' },
  progressDotActive: { backgroundColor: '#4caf50', width: 28 },
  questionText: { fontSize: 16, color: '#1a3c2a', lineHeight: 24, marginBottom: 16, fontStyle: 'italic' },
  specCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, elevation: 1 },
  specText: { color: '#333', fontSize: 14, lineHeight: 24 },
  stuckBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff3e0', borderRadius: 12, padding: 14, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: '#f57c00' },
  stuckLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stuckIcon: { fontSize: 20 },
  stuckTitle: { fontSize: 13, fontWeight: '800', color: '#e65100' },
  stuckSub: { fontSize: 11, color: '#bf360c', marginTop: 1 },
  stuckBtn: { backgroundColor: '#f57c00', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  stuckBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  stuckChatAlert: { backgroundColor: '#fff3e0', borderRadius: 10, padding: 12, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#f57c00' },
  stuckChatAlertText: { fontSize: 13, color: '#e65100', fontWeight: '600' },
  personaRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  personaBtn: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 10, borderWidth: 2, borderColor: 'transparent', elevation: 1 },
  personaBtnActive: { backgroundColor: '#f8f8ff' },
  personaEmoji: { fontSize: 18 },
  personaLabel: { fontSize: 11, fontWeight: '700', color: '#aaa' },
  personaBadge: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 16, elevation: 1, borderLeftWidth: 4 },
  personaAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  personaAvatarText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  personaName: { fontSize: 15, fontWeight: '700', color: '#1a3c2a' },
  personaRole: { fontSize: 12, color: '#aaa', marginTop: 2 },
  personaBadgePill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  personaBadgePillText: { fontSize: 11, fontWeight: '800' },
  chatBubble: { borderRadius: 14, padding: 14, marginBottom: 10 },
  chatUser: { alignSelf: 'flex-end', maxWidth: '85%' },
  chatAgent: { backgroundColor: '#fff', alignSelf: 'flex-start', maxWidth: '90%', elevation: 1 },
  chatAgentLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  chatText: { fontSize: 14, lineHeight: 22, color: '#333' },
  chatInputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 8 },
  chatInput: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, color: '#333', fontSize: 14, maxHeight: 100, elevation: 1, borderWidth: 1.5 },
  chatSendBtn: { borderRadius: 14, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chatSendText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  // Mikrofon stilleri
  micContainer: { alignItems: 'center', justifyContent: 'flex-end', gap: 4, paddingBottom: 4 },
  micBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  micIcon: { fontSize: 18 },
  micLabel: { fontSize: 9, fontWeight: '600' },
  rmsWaveBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 20, marginBottom: 2 },
  rmsWaveBar: { width: 3, borderRadius: 2, minHeight: 4 },
  callFloatBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14, marginTop: 14, elevation: 3 },
  callFloatIcon: { fontSize: 18 },
  callFloatText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: '#000000aa', alignItems: 'center', justifyContent: 'center' },
  callCard: { backgroundColor: '#fff', borderRadius: 24, padding: 32, alignItems: 'center', width: 300, elevation: 20 },
  callPulse: { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 3, top: 22 },
  callAvatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  callAvatarText: { fontSize: 36 },
  callName: { fontSize: 18, fontWeight: '800', color: '#1a3c2a', marginBottom: 6 },
  callStatus: { fontSize: 14, color: '#888', marginBottom: 8 },
  callSubStatus: { fontSize: 13, color: '#4caf50', marginBottom: 20 },
  callDots: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  callDot: { width: 8, height: 8, borderRadius: 4 },
  callCloseBtn: { borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  callCloseBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#d0e8d0', backgroundColor: '#f0faf0', marginTop: 20 },
  navItem: { alignItems: 'center' },
  navText: { fontSize: 13, color: '#aaa', fontWeight: '600' },
  navActive: { color: '#4caf50', borderBottomWidth: 2, borderBottomColor: '#4caf50', paddingBottom: 2 },
});