import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Animated, Alert,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AuditWidget from './AuditWidget';

type Phase = 'input' | 'questioning' | 'spec' | 'expert';
interface QA { question: string; answer: string; }
interface ChatMessage { role: 'user' | 'assistant'; content: string; }

// ✅ Gemini API
const GEMINI_API_KEY = 'AIzaSyAaP2MeB5igoXc2whgW6ZaeClNTe_bL6bM';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

async function callGemini(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  try {
    // Gemini için mesajları dönüştür
    const contents = [];

    // Sistem promptunu ilk user mesajı olarak ekle
    const allMessages = [
      { role: 'user' as const, content: systemPrompt + '\n\n---\n\n' + messages[0]?.content },
      ...messages.slice(1),
    ];

    for (const msg of allMessages) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err?.error?.message || 'Gemini API Hatası');
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
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
      const q = await callGemini(QUESTION_SYSTEM, [{ role: 'user', content: `Raw idea: "${rawIdea}"\nAsk your first engineering question.` }]);
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
        const s = await callGemini(SPEC_SYSTEM, [{ role: 'user', content: `Raw idea: "${rawIdea}"\n\nQ&A:\n${qaText}\n\nGenerate spec.` }]);
        fadeTransition(() => { setSpec(s.trim()); setPhase('spec'); });
      } else {
        const q = await callGemini(QUESTION_SYSTEM, [{ role: 'user', content: `Raw idea: "${rawIdea}"\n\nPrevious Q&A:\n${qaText}\n\nAsk question ${questionIndex + 1}.` }]);
        fadeTransition(() => { setCurrentQuestion(q.trim()); setQuestionIndex(i => i + 1); });
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
    setChatMessages([{ role: 'assistant', content: `Merhaba! Fikrin "${rawIdea}" hakkında soru sorabilirsin.` }]);
    fadeTransition(() => setPhase('expert'));
  };

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated); setChatInput(''); setChatLoading(true);
    try {
      const reply = await callGemini(
        `Sen NOKTA uzman agentısın. Fikir: ${rawIdea}\nSpec: ${spec}\nKısa cevaplar ver. Türkçe konuş.`,
        updated
      );
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply.trim() }]);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) { Alert.alert('Hata', e.message);
    } finally { setChatLoading(false); }
  }, [chatInput, chatMessages, chatLoading, rawIdea, spec]);

  return (
    <View style={{ flex: 1 }}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={phase === 'expert' ? chatScrollRef : undefined}
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.logo}>● nokta</Text>
            <TouchableOpacity style={styles.seedBtn}>
              <Text style={styles.seedIcon}>🌱</Text>
            </TouchableOpacity>
          </View>

          <Animated.View style={{ opacity: fadeAnim }}>
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
                  <TouchableOpacity style={styles.secondaryBtnGreen} onPress={openExpertChat}>
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

            {phase === 'spec' && (
              <View>
                <Text style={styles.heroTitle}>Plan Hazır! 🎉</Text>
                <View style={styles.specCard}>
                  <Text style={styles.specText}>{spec}</Text>
                </View>
                <TouchableOpacity style={styles.secondaryBtnGreen} onPress={openExpertChat}>
                  <Text style={styles.secondaryBtnGreenText}>Uzman Görüşü Al</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 12 }]} onPress={handleReset}>
                  <Text style={styles.secondaryBtnText}>+ Yeni Fikir</Text>
                </TouchableOpacity>
              </View>
            )}

            {phase === 'expert' && (
              <View>
                <Text style={styles.heroTitle}>Uzman Görüşü</Text>
                {chatMessages.map((msg, i) => (
                  <View key={i} style={[styles.chatBubble, msg.role === 'user' ? styles.chatUser : styles.chatAgent]}>
                    <Text style={styles.chatText}>{msg.content}</Text>
                  </View>
                ))}
                {chatLoading && <ActivityIndicator color="#4caf50" style={{ margin: 16 }} />}
                <View style={styles.chatInputRow}>
                  <TextInput
                    style={styles.chatInput}
                    value={chatInput}
                    onChangeText={setChatInput}
                    placeholder="Sorunuzu yazın..."
                    placeholderTextColor="#aaa"
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.chatSendBtn, !chatInput.trim() && styles.btnDisabled]}
                    onPress={handleSendChat}
                    disabled={!chatInput.trim() || chatLoading}
                  >
                    <Text style={styles.chatSendText}>→</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 12 }]} onPress={() => fadeTransition(() => setPhase(spec ? 'spec' : 'input'))}>
                  <Text style={styles.secondaryBtnText}>← Geri Dön</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>

          <View style={styles.bottomNav}>
            <TouchableOpacity style={styles.navItem}>
              <Text style={[styles.navText, styles.navActive]}>Ana Sayfa</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem}>
              <Text style={styles.navText}>Keşfet</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem}>
              <Text style={styles.navText}>Profil</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AuditWidget currentPhase={phase} spec={spec} idea={rawIdea} />
    </View>
  );
}

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
  btnDisabled: { backgroundColor: '#c8e6c9' },
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
  chatBubble: { borderRadius: 14, padding: 14, marginBottom: 10 },
  chatUser: { backgroundColor: '#4caf50', alignSelf: 'flex-end', maxWidth: '85%' },
  chatAgent: { backgroundColor: '#fff', alignSelf: 'flex-start', maxWidth: '90%', elevation: 1 },
  chatText: { fontSize: 14, lineHeight: 22, color: '#333' },
  chatInputRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginTop: 8 },
  chatInput: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, color: '#333', fontSize: 14, maxHeight: 100, elevation: 1 },
  chatSendBtn: { backgroundColor: '#4caf50', borderRadius: 14, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  chatSendText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#d0e8d0', backgroundColor: '#f0faf0', marginTop: 20 },
  navItem: { alignItems: 'center' },
  navText: { fontSize: 13, color: '#aaa', fontWeight: '600' },
  navActive: { color: '#4caf50', borderBottomWidth: 2, borderBottomColor: '#4caf50', paddingBottom: 2 },
});