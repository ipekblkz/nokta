import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, ScrollView, TextInput, Alert,
} from 'react-native';

interface AuditNote {
  id: string;
  screen: string;
  note: string;
  timestamp: string;
  status: 'open' | 'fixed';
}

interface Props {
  currentPhase?: string;
  spec?: string;
  idea?: string;
}

export default function AuditWidget({ currentPhase = '', spec = '', idea = '' }: Props) {
  const [notes, setNotes] = useState<AuditNote[]>([]);
  const [showList, setShowList] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [noteText, setNoteText] = useState('');

  const addNote = () => {
    if (!noteText.trim()) return;
    const newNote: AuditNote = {
      id: Date.now().toString(36),
      screen: currentPhase || 'unknown',
      note: noteText.trim(),
      timestamp: new Date().toISOString(),
      status: 'open',
    };
    setNotes(prev => [...prev, newNote]);
    setNoteText('');
    setShowAdd(false);
    Alert.alert('✅ Not Eklendi', 'Audit notu kaydedildi.');
  };

  const toggleStatus = (id: string) => {
    setNotes(prev => prev.map(n =>
      n.id === id ? { ...n, status: n.status === 'open' ? 'fixed' : 'open' } : n
    ));
  };

  const deleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const exportMarkdown = () => {
    if (notes.length === 0) { Alert.alert('Boş', 'Henüz not yok.'); return; }
    const open = notes.filter(n => n.status === 'open').length;
    const fixed = notes.filter(n => n.status === 'fixed').length;
    let md = `# Bug Raporu — DotCapture\n\n`;
    md += `**Tarih:** ${new Date().toLocaleString('tr-TR')}\n`;
    md += `**Toplam:** ${notes.length} not · 🔴 ${open} açık · ✅ ${fixed} düzeltildi\n\n`;
    if (idea) md += `**Fikir:** ${idea}\n\n`;
    md += `---\n\n`;
    notes.forEach((n, i) => {
      md += `## ${n.status === 'open' ? '🔴' : '✅'} #${i + 1} — ${n.note}\n\n`;
      md += `- **Ekran:** ${n.screen}\n- **Durum:** ${n.status === 'open' ? 'Açık' : 'Düzeltildi'}\n\n---\n\n`;
    });
    Alert.alert('📋 Markdown Rapor', md.substring(0, 600) + (md.length > 600 ? '\n...' : ''));
  };

  return (
    <>
      {/* FAB — sabit sağ üst */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAdd(true)}
        onLongPress={() => setShowList(true)}
        delayLongPress={400}
      >
        <Text style={styles.fabIcon}>🐛</Text>
        {notes.filter(n => n.status === 'open').length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{notes.filter(n => n.status === 'open').length}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Not Ekle Modal */}
      <Modal visible={showAdd} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>🐛 Audit Notu</Text>
            <Text style={styles.modalScreen}>Ekran: {currentPhase || 'unknown'}</Text>
            <TextInput
              style={styles.modalInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Bug veya UX sorununu yaz..."
              placeholderTextColor="#aaa"
              multiline
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => { setShowAdd(false); setNoteText(''); }}>
                <Text style={styles.modalBtnCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtnSave, !noteText.trim() && styles.btnDisabled]} onPress={addNote} disabled={!noteText.trim()}>
                <Text style={styles.modalBtnSaveText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Not Listesi Modal */}
      <Modal visible={showList} transparent animationType="slide">
        <View style={styles.listOverlay}>
          <View style={styles.listBox}>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>🐛 Audit Notları ({notes.length})</Text>
              <TouchableOpacity onPress={() => setShowList(false)}>
                <Text style={styles.listClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.listScroll}>
              {notes.length === 0 ? (
                <Text style={styles.emptyText}>Henüz not yok.</Text>
              ) : (
                notes.map((n) => (
                  <View key={n.id} style={styles.noteCard}>
                    <View style={styles.noteHeader}>
                      <Text style={styles.noteStatus}>{n.status === 'open' ? '🔴' : '✅'}</Text>
                      <Text style={styles.noteScreen}>{n.screen}</Text>
                      <Text style={styles.noteTime}>{new Date(n.timestamp).toLocaleTimeString('tr-TR')}</Text>
                    </View>
                    <Text style={styles.noteText}>{n.note}</Text>
                    <View style={styles.noteActions}>
                      <TouchableOpacity onPress={() => toggleStatus(n.id)} style={styles.noteBtn}>
                        <Text style={styles.noteBtnText}>{n.status === 'open' ? '✅ Düzelt' : '🔴 Aç'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteNote(n.id)} style={styles.noteBtn}>
                        <Text style={[styles.noteBtnText, { color: '#e53e3e' }]}>Sil</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
            <View style={styles.listFooter}>
              <TouchableOpacity style={styles.exportBtn} onPress={exportMarkdown}>
                <Text style={styles.exportBtnText}>📋 Markdown Export</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtn} onPress={() => { setShowList(false); setShowAdd(true); }}>
                <Text style={styles.addBtnText}>+ Not Ekle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    zIndex: 999,
    top: 60,
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#4caf50',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabIcon: { fontSize: 22 },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#ff5252', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { color: '#2d6a4f', fontSize: 16, fontWeight: '800', marginBottom: 8 },
  modalScreen: { color: '#888', fontSize: 12, marginBottom: 16 },
  modalInput: { color: '#333', fontSize: 15, minHeight: 80, borderWidth: 1, borderColor: '#d0e8d0', borderRadius: 10, padding: 12, textAlignVertical: 'top', marginBottom: 16, backgroundColor: '#f6fff6' },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalBtnCancel: { flex: 1, borderWidth: 1, borderColor: '#d0e8d0', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  modalBtnCancelText: { color: '#888', fontWeight: '700' },
  modalBtnSave: { flex: 1, backgroundColor: '#4caf50', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  modalBtnSaveText: { color: '#fff', fontWeight: '800' },
  btnDisabled: { backgroundColor: '#c8e6c9' },
  listOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  listBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e8f5e9' },
  listTitle: { color: '#2d6a4f', fontSize: 16, fontWeight: '800' },
  listClose: { color: '#aaa', fontSize: 18 },
  listScroll: { maxHeight: 400 },
  emptyText: { color: '#aaa', textAlign: 'center', padding: 40 },
  noteCard: { margin: 12, padding: 14, backgroundColor: '#f6fff6', borderRadius: 10, borderWidth: 1, borderColor: '#d0e8d0' },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  noteStatus: { fontSize: 14 },
  noteScreen: { color: '#888', fontSize: 11, flex: 1 },
  noteTime: { color: '#aaa', fontSize: 10 },
  noteText: { color: '#333', fontSize: 13, lineHeight: 20, marginBottom: 10 },
  noteActions: { flexDirection: 'row', gap: 12 },
  noteBtn: { paddingVertical: 4 },
  noteBtnText: { color: '#4caf50', fontSize: 12, fontWeight: '700' },
  listFooter: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: '#e8f5e9' },
  exportBtn: { flex: 1, backgroundColor: '#e8f5e9', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  exportBtnText: { color: '#2d6a4f', fontWeight: '700', fontSize: 12 },
  addBtn: { flex: 1, backgroundColor: '#4caf50', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});