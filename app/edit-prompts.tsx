import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { meApi } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth';

import { useTheme, makeStyles, type Theme, type, space, radius, fonts } from '@/lib/theme';
import { IconButton } from '@/components/ui';
import { useLanguage, useT } from '@/lib/i18n';
interface PromptQuestion { id: string; question_text: string; category?: string; }
interface UserPrompt { question_id: string; answer_text: string; display_order: number; }

export default function EditPromptsScreen() {
  const tr = useT();
  const { language } = useLanguage();
  const { me, setMe } = useAuth();
  const t = useTheme();
  const styles = useStylesTheme();
  const router = useRouter();
  const [allQuestions, setAllQuestions] = useState<PromptQuestion[]>([]);
  const [userPrompts, setUserPrompts] = useState<UserPrompt[]>([]);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [draftAnswer, setDraftAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);


  // Questions come from the API in both languages; show the one the app is using.
  const loadData = async () => {
    try {
      setLoading(true);
      const questions = await meApi.promptQuestions();
      setAllQuestions(questions.map((q) => ({ id: q.id, question_text: q.text[language === 'id' ? 'id' : 'en'], category: q.category ?? undefined })));
      if (me) {
        setUserPrompts(me.prompts.map((p) => ({ question_id: p.questionId, answer_text: p.answer, display_order: p.position })));
      }
    } catch (e) {
      Alert.alert(tr('prompts.error'), apiErrorMessage(e, tr));
    } finally {
      setLoading(false);
    }
  };

  const savePrompts = async (list: UserPrompt[]) => {
    const updated = await meApi.setPrompts(
      [...list].sort((a, b) => a.display_order - b.display_order).map((p) => ({ questionId: p.question_id, answer: p.answer_text })),
    );
    setMe(updated);
    setUserPrompts(updated.prompts.map((p) => ({ question_id: p.questionId, answer_text: p.answer, display_order: p.position })));
  };

  useEffect(() => { loadData(); }, [language]);
  const handleSelectQuestion = (questionId: string) => {
    if (userPrompts.length >= 3 && !userPrompts.find(p => p.question_id === questionId)) {
      Alert.alert(tr('prompts.maxTitle'), tr('prompts.maxBody'));
      return;
    }
    const existing = userPrompts.find(p => p.question_id === questionId);
    setDraftAnswer(existing?.answer_text || '');
    setEditingQuestionId(questionId);
  };

  const handleSaveAnswer = async () => {
    if (!draftAnswer.trim()) {
      Alert.alert(tr('prompts.requiredTitle'), tr('prompts.requiredBody'));
      return;
    }
    if (!editingQuestionId) return;
    try {
      setSaving(true);
      const answer = draftAnswer.trim().slice(0, 150);
      const existing = userPrompts.find((p) => p.question_id === editingQuestionId);
      const next = existing
        ? userPrompts.map((p) => (p.question_id === editingQuestionId ? { ...p, answer_text: answer } : p))
        : [...userPrompts, { question_id: editingQuestionId, answer_text: answer, display_order: userPrompts.length }];
      await savePrompts(next);
      setEditingQuestionId(null);
      setDraftAnswer('');
    } catch (e) {
      Alert.alert(tr('prompts.error'), apiErrorMessage(e, tr));
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePrompt = async (questionId: string) => {
    try {
      await savePrompts(userPrompts.filter((p) => p.question_id !== questionId));
    } catch (e) {
      Alert.alert(tr('prompts.error'), apiErrorMessage(e, tr));
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel={tr('common.back')} />
        <Text style={styles.headerTitle}>{tr('prompts.header')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.md, paddingBottom: 40 }}>
        <Text style={styles.title}>{tr('prompts.yours', { n: userPrompts.length })}</Text>
        <Text style={styles.subtitle}>{tr('prompts.subtitle')}</Text>

        {/* Selected User Prompts */}
        {userPrompts.map((p) => {
          const question = allQuestions.find(q => q.id === p.question_id);
          return (
            <View key={p.question_id} style={styles.selectedPromptCard}>
              <Text style={styles.questionText}>{question?.question_text || tr('prompts.question')}</Text>
              <Text style={styles.answerText}>"{p.answer_text}"</Text>
              <View style={styles.promptActions}>
                <TouchableOpacity accessibilityRole="button" onPress={() => handleSelectQuestion(p.question_id)}>
                  <Text style={styles.editLink}>{tr('prompts.editAnswer')}</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={() => handleRemovePrompt(p.question_id)}>
                  <Text style={styles.removeLink}>{tr('prompts.remove')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Answer Editor Panel */}
        {editingQuestionId && (
          <View style={styles.answerEditor}>
            <Text style={styles.editorQuestionText}>
              {allQuestions.find(q => q.id === editingQuestionId)?.question_text}
            </Text>
            <TextInput
              style={styles.answerInput}
              placeholder={tr('prompts.placeholder')}
              placeholderTextColor={t.textSecondary}
              value={draftAnswer}
              onChangeText={setDraftAnswer}
              maxLength={150}
              multiline
            />
            <Text style={styles.charCount}>{draftAnswer.length}/150</Text>
            <View style={styles.editorButtonsRow}>
              <TouchableOpacity accessibilityRole="button" style={styles.cancelButton} onPress={() => setEditingQuestionId(null)}>
                <Text style={styles.cancelButtonText}>{tr('prompts.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={styles.saveButton} onPress={handleSaveAnswer} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveButtonText}>{tr('prompts.save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Available Question Bank Options */}
        {userPrompts.length < 3 && !editingQuestionId && (
          <>
            <Text style={styles.sectionLabel}>{tr('prompts.pick')}</Text>
            {allQuestions
              .filter(q => !userPrompts.find(p => p.question_id === q.id))
              .map((q) => (
                <TouchableOpacity accessibilityRole="button" 
                  key={q.id} 
                  style={styles.questionOption}
                  onPress={() => handleSelectQuestion(q.id)}
                >
                  <Text style={styles.questionOptionText}>{q.question_text}</Text>
                  <Ionicons name="add-circle-outline" size={20} color={t.primary} />
                </TouchableOpacity>
              ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const useStylesTheme = makeStyles((t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  centerContainer: { flex: 1, backgroundColor: t.bg, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: 54,
    paddingBottom: space.xs,
    backgroundColor: t.bg,
  },
  backButton: { padding: space.xxs },
  headerTitle: { ...type.heading, color: t.text },
  title: { ...type.title, color: t.text, marginBottom: space.xxs, marginTop: space.xs },
  subtitle: { ...type.body, color: t.textSecondary, marginBottom: space.xl },
  sectionLabel: { ...type.heading, color: t.text, marginTop: space.xl, marginBottom: space.xs },
  selectedPromptCard: {
    backgroundColor: t.surface,
    borderRadius: 24,
    padding: space.md,
    marginBottom: space.md,
  },
  questionText: { ...type.caption, color: t.primaryText, fontFamily: fonts.bodyBold, marginBottom: space.xxs },
  answerText: { ...type.body, color: t.text, marginBottom: space.md, fontFamily: fonts.bodyBold },
  promptActions: { flexDirection: 'row', gap: space.xl },
  editLink: { color: t.textSecondary, fontFamily: fonts.bodyBold, fontSize: 13 },
  removeLink: { color: t.danger, fontFamily: fonts.bodyBold, fontSize: 13 },
  answerEditor: {
    backgroundColor: t.surfaceMuted,
    borderRadius: 24,
    padding: space.md,
    marginBottom: space.xl,
    borderWidth: 1,
    borderColor: t.primary,
  },
  editorQuestionText: { ...type.heading, color: t.text, marginBottom: space.xs },
  answerInput: {
    ...type.body,
    color: t.text,
    backgroundColor: t.surface,
    borderRadius: 16,
    padding: space.md,
    marginTop: space.xxs,
    minHeight: 90,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: t.border,
  },
  charCount: { ...type.caption, color: t.textSecondary, textAlign: 'right', marginTop: space.xxs },
  editorButtonsRow: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  cancelButton: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: 'center',
  },
  cancelButtonText: { ...type.button, color: t.textSecondary },
  saveButton: {
    flex: 2,
    backgroundColor: t.primary,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  saveButtonText: { ...type.button, color: '#FFFFFF' },
  questionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    padding: space.md,
    marginBottom: space.xs,
  },
  questionOptionText: { ...type.callout, color: t.text, flex: 1, paddingRight: space.xs, fontFamily: fonts.bodyBold },
}));
