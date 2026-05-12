import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Animated, Alert,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

type Phase = 'input' | 'questioning' | 'spec' | 'expert';
interface QA { question: string; answer: string; }
interface ChatMessage { role: 'user' | 'assistant'; content: string; }

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const YOUR_API_KEY = 'BURAYA_API_KEYINIZI_YAZIN';

async function callClaude(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  try {
    const response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': YOUR_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1000,
        system: systemPrompt,
        messages,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData?.error?.message || 'API Hatası');
    }
    const data = await response.json();
    return data.content?.[0]?.text ?? '';
  } catch (error: any) {
    throw error;
  }
}

const QUESTION_SYSTEM = `You are an engineering-guided idea interviewer for the NOKTA system.
Ask ONE sharp engineering question. Focus on: problem, user, scope, constraints, success metrics.
Be concise. One sentence. No preamble. Ask in the same language the user used.`;

const SPEC_SYSTEM = `You are a product spec writer for the NOKTA system.
Produce a ONE-PAGE product spec with: ## Problem, ## User, ## Core Feature, ## Scope, ## Constraints, ## Success Metric
Engineering-grade language. Write in the same language the user used.`;

export default function App() {
  return <SafeAreaProvider><DotCapture /></SafeAreaProvider>;
}

function DotCapture() {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('input');
  const [rawIdea, setRawIdea] = useState('');
  const [qas, setQas] = useState<QA[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [spec, setSpec] = useState('');
  const [loading, setLoading] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<ScrollView>(null);
  const MAX_QUESTIONS = 4;

  const fadeTransition = (callback: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      callback();
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  };

  const handleIdeaSubmit = useCallback(async () => {
    if (!rawIdea.trim()) return;
    setLoading(true);
    try {
      const q = await callClaude(QUESTION_SYSTEM, [{ role: 'user', content: `Raw idea: "${rawIdea}"\nAsk your first engineering question.` }]);
      fadeTransition(() => { setCurrentQuestion(q.trim()); setPhase('questioning'); setQuestionIndex(1); });
    } catch (e: any) { Alert.alert('Hata', e.message || 'API bağlantısı başarısız.');
    } finally { setLoading(false); }
  }, [rawIdea]);

  const handleAnswerSubmit = useCallback(async () => {
    if (!currentAnswer.trim()) return;
    const newQas = [...qas, { question: currentQuestion, answer: currentAnswer }];
    setQas(newQas); setCurrentAnswer(''); setLoading(true);
    try {
      const qaText = newQas.map((qa, i) => `Q${i + 1}: ${qa.question}\nA: ${qa.answer}`).join('\n\n');
      if (questionIndex >= MAX_QUESTIONS) {
        const generatedSpec = await callClaude(SPEC_SYSTEM, [{ role: 'user', content: `Raw idea: "${rawIdea}"\n\nQ&A:\n${qaText}\n\nGenerate spec.` }]);
        fadeTransition(() => { setSpec(generatedSpec.trim()); setPhase('spec'); });
      } else {
        const nextQ = await callClaude(QUESTION_SYSTEM, [{ role: 'user', content: `Raw idea: "${rawIdea}"\n\nPrevious Q&A:\n${qaText}\n\nAsk question ${questionIndex + 1}.` }]);
        fadeTransition(() => { setCurrentQuestion(nextQ.trim()); setQuestionIndex(i => i + 1); });
      }
    } catch (e: any) { Alert.alert('Hata', e.message || 'Bir sorun oluştu.');
    } finally { setLoading(false); }
  }, [currentAnswer, currentQuestion, qas, questionIndex, rawIdea]);

  const handleReset = () => {
    fadeTransition(() => {
      setPhase('input'); setRawIdea(''); setQas([]); setCurrentQuestion('');
      setCurrentAnswer(''); setSpec(''); setQuestionIndex(0); setChatMessages([]);
    });
  };

  const openExpertChat = () => {
    const welcomeMsg: ChatMessage = {
      role: 'assistant',
      content: `Merhaba! Ben NOKTA Uzman Agentıyım.\n\nFikrini inceledim: "${rawIdea}"\n\nSpec hakkında soru sorabilir, pazar analizi veya teknik öneri isteyebilirsin. Ne sormak istersin?`,
    };
    setChatMessages([welcomeMsg]);
    fadeTransition(() => setPhase('expert'));
  };

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages); setChatInput(''); setChatLoading(true);
    const expertSystem = `Sen NOKTA uzman agentısın. Bu fikir ve spec hakkında uzmansın:\n\nFİKİR: ${rawIdea}\n\nSPEC:\n${spec}\n\nKısa net cevaplar ver. Türkçe konuş.`;
    try {
      const reply = await callClaude(expertSystem, updatedMessages);
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply.trim() }]);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) { Alert.alert('Hata', e.message || 'Agent yanıt veremedi.');
    } finally { setChatLoading(false); }
  }, [chatInput, chatMessages, chatLoading, rawIdea, spec]);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView ref={phase === 'expert' ? chatScrollRef : undefined} style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.dot} />
          <Text style={styles.title}>NOKTA</Text>
          <Text style={styles.subtitle}>{phase === 'expert' ? 'Uzman Agent · Track A' : 'Dot Capture & Enrich · Track A'}</Text>
        </View>
        <Animated.View style={{ opacity: fadeAnim }}>

          {phase === 'input' && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>HAM FİKİR</Text>
              <Text style={styles.cardHint}>Aklındaki dağınık düşünceyi yaz, mühendislik süzgecinden geçirelim.</Text>
              <TextInput style={styles.ideaInput} value={rawIdea} onChangeText={setRawIdea}
                placeholder="örn: Yerel çiftçiler için lojistik ağı..." placeholderTextColor="#3a3a4a" multiline />
              <TouchableOpacity style={[styles.btn, !rawIdea.trim() && styles.btnDisabled]}
                onPress={handleIdeaSubmit} disabled={!rawIdea.trim() || loading}>
                {loading ? <ActivityIndicator color="#0a0a0f" /> : <Text style={styles.btnText}>NOKTAYI YAKALA →</Text>}
              </TouchableOpacity>
            </View>
          )}

          {phase === 'questioning' && (
            <View>
              <View style={styles.progressRow}>
                {Array.from({ length: MAX_QUESTIONS }).map((_, i) => (
                  <View key={i} style={[styles.progressDot, i < questionIndex && styles.progressDotDone, i === questionIndex - 1 && styles.progressDotActive]} />
                ))}
              </View>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>SORU {questionIndex}</Text>
                <Text style={styles.questionText}>{currentQuestion}</Text>
                <TextInput style={styles.answerInput} value={currentAnswer} onChangeText={setCurrentAnswer}
                  placeholder="Cevabın..." placeholderTextColor="#3a3a4a" multiline />
                <TouchableOpacity style={[styles.btn, !currentAnswer.trim() && styles.btnDisabled]}
                  onPress={handleAnswerSubmit} disabled={!currentAnswer.trim() || loading}>
                  {loading ? <ActivityIndicator color="#0a0a0f" /> : <Text style={styles.btnText}>{questionIndex >= MAX_QUESTIONS ? 'SPEC OLUŞTUR →' : 'İLERİ →'}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {phase === 'spec' && (
            <View>
              <View style={styles.specHeader}>
                <Text style={styles.specBadge}>✦ SPEC HAZIR</Text>
                <Text style={styles.specTitle}>Ürün Spesifikasyonu</Text>
              </View>
              <View style={styles.specCard}><Text style={styles.specText}>{spec}</Text></View>
              <TouchableOpacity style={styles.btnExpert} onPress={openExpertChat}>
                <Text style={styles.btnExpertText}>👤 UZMAN GÖRÜŞÜ AL →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSecondary} onPress={handleReset}>
                <Text style={styles.btnSecondaryText}>+ YENİ NOKTA</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'expert' && (
            <View>
              <View style={styles.chatContainer}>
                {chatMessages.map((msg, i) => (
                  <View key={i} style={[styles.chatBubble, msg.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAgent]}>
                    {msg.role === 'assistant' && <Text style={styles.chatAgentLabel}>👤 UZMAN</Text>}
                    <Text style={[styles.chatText, msg.role === 'user' ? styles.chatTextUser : styles.chatTextAgent]}>{msg.content}</Text>
                  </View>
                ))}
                {chatLoading && <View style={styles.chatBubbleAgent}><ActivityIndicator color="#e8d5a3" size="small" /></View>}
              </View>
              <View style={styles.chatInputRow}>
                <TextInput style={styles.chatInput} value={chatInput} onChangeText={setChatInput}
                  placeholder="Uzmana sor..." placeholderTextColor="#3a3a4a" multiline />
                <TouchableOpacity style={[styles.chatSendBtn, !chatInput.trim() && styles.btnDisabled]}
                  onPress={handleSendChat} disabled={!chatInput.trim() || chatLoading}>
                  <Text style={styles.chatSendText}>→</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={[styles.btnSecondary, { marginTop: 12 }]} onPress={() => fadeTransition(() => setPhase('spec'))}>
                <Text style={styles.btnSecondaryText}>← SPEC'E DÖN</Text>
              </TouchableOpacity>
            </View>
          )}

        </Animated.View>
        <Text style={styles.footer}>NOKTA · NAIM Ecosystem · 231118087</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },
  header: { alignItems: 'center', marginBottom: 40 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e8d5a3', marginBottom: 14 },
  title: { color: '#e8d5a3', fontSize: 30, fontWeight: '800', letterSpacing: 8 },
  subtitle: { color: '#444', fontSize: 10, letterSpacing: 2, marginTop: 6, textTransform: 'uppercase' },
  card: { backgroundColor: '#111118', borderWidth: 1, borderColor: '#1e1e2e', borderRadius: 14, padding: 22 },
  cardLabel: { color: '#e8d5a3', fontSize: 9, letterSpacing: 4, fontWeight: '700', marginBottom: 10 },
  cardHint: { color: '#444', fontSize: 13, lineHeight: 20, marginBottom: 18 },
  ideaInput: { color: '#ddd', fontSize: 17, minHeight: 80, textAlignVertical: 'top', borderBottomWidth: 1, borderBottomColor: '#1e1e2e', marginBottom: 22 },
  answerInput: { color: '#ddd', fontSize: 15, minHeight: 60, textAlignVertical: 'top', borderBottomWidth: 1, borderBottomColor: '#1e1e2e', marginBottom: 22 },
  questionText: { color: '#ccc', fontSize: 16, lineHeight: 26, marginBottom: 20, fontStyle: 'italic' },
  btn: { backgroundColor: '#e8d5a3', borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#1a1a24' },
  btnText: { color: '#0a0a0f', fontWeight: '800', letterSpacing: 2, fontSize: 12 },
  btnSecondary: { borderWidth: 1, borderColor: '#1e1e2e', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  btnSecondaryText: { color: '#444', fontWeight: '700', letterSpacing: 2, fontSize: 12 },
  btnExpert: { backgroundColor: '#1a2a1a', borderWidth: 1, borderColor: '#2a4a2a', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginBottom: 12 },
  btnExpertText: { color: '#6abf6a', fontWeight: '800', letterSpacing: 2, fontSize: 12 },
  progressRow: { flexDirection: 'row', gap: 8, marginBottom: 20, justifyContent: 'center' },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1e1e2e' },
  progressDotDone: { backgroundColor: '#e8d5a3' },
  progressDotActive: { backgroundColor: '#e8d5a3', width: 28 },
  specHeader: { marginBottom: 20 },
  specBadge: { color: '#e8d5a3', fontSize: 10, letterSpacing: 3, fontWeight: '700', marginBottom: 8 },
  specTitle: { color: '#eee', fontSize: 24, fontWeight: '800' },
  specCard: { backgroundColor: '#111118', borderWidth: 1, borderColor: '#1e1e2e', borderRadius: 14, padding: 22, marginBottom: 16 },
  specText: { color: '#bbb', fontSize: 14, lineHeight: 24 },
  chatContainer: { marginBottom: 16 },
  chatBubble: { borderRadius: 12, padding: 14, marginBottom: 10 },
  chatBubbleUser: { backgroundColor: '#1a1a2e', alignSelf: 'flex-end', maxWidth: '85%' },
  chatBubbleAgent: { backgroundColor: '#111118', borderWidth: 1, borderColor: '#1e1e2e', alignSelf: 'flex-start', maxWidth: '90%' },
  chatAgentLabel: { color: '#6abf6a', fontSize: 9, letterSpacing: 3, fontWeight: '700', marginBottom: 6 },
  chatText: { fontSize: 14, lineHeight: 22 },
  chatTextUser: { color: '#ddd' },
  chatTextAgent: { color: '#bbb' },
  chatInputRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  chatInput: { flex: 1, backgroundColor: '#111118', borderWidth: 1, borderColor: '#1e1e2e', borderRadius: 12, padding: 14, color: '#ddd', fontSize: 14, maxHeight: 100 },
  chatSendBtn: { backgroundColor: '#e8d5a3', borderRadius: 12, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  chatSendText: { color: '#0a0a0f', fontSize: 20, fontWeight: '800' },
  footer: { color: '#222', fontSize: 10, textAlign: 'center', marginTop: 40, letterSpacing: 2 },
});