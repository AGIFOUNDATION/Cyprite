globalThis.PageContents = globalThis.PageContents || {};

globalThis.PageContents.mainPage = `
<div id="Container" class="cyprite_extension panel_mask" @click="onCloseMeByMask">
	<div class="panel_frame">
		<div id="Panel" class="panel_container" chat="false" name="summary">
			<div class="panel_logo" @mouseenter="updateModelList">
				<img src="{extension_root}/images/cyprite.png">
				<div id="ModelList" class="panel_model_chooser" @click="onChooseModel"></div>
				<div id="ThingkingHint1" class="thinking_hint" titlePath="thinkingHeartBeating"></div>
			</div>
			<div class="panel_closer" @click="onCloseMe">
				<img src="{extension_root}/images/downToCenter.svg">
			</div>
			<div class="panel_tabs_area">
				<div class="panel_tab active" action="showSummary" titlePath="buttons.showSummaryPanel" @click="onShowPageSummary"></div>
				<div class="panel_tab" action="showTranslate" titlePath="buttons.showTranslatePanel" @click="onShowTranslationResult"></div>
				<div class="panel_tab" action="showComprehensive" titlePath="buttons.showComprehensivePanel" @click="onShowComprehensive"></div>
				<div class="panel_title_editor" contenteditable="true" @keydown="onEditContentTitle"></div>
				<div id="ChatTrigger" class="panel_button showChatter always_show" titlePath="buttons.showChatPanel" @click="onChatTrigger"></div>
				<div class="panel_button clearHistory active show" group="summary" titlePath="buttons.btnClearHistory" @click="clearSummaryConversation"></div>
				<div class="panel_button reSummary always active show" group="summary" titlePath="buttons.btnReSummary" @click="summarizePage"></div>
				<div class="panel_button always" group="translate">
					<span titlePath="buttons.hintTranslateInto"></span>
					<input id="TranslationLanguage" class="panel_input translate_target_language">
				</div>
				<div class="panel_button image_button copyContent always_show" @click="copyReplyContent">
					<img button="true" src="{extension_root}/images/copy.svg">
				</div>
			</div>
			<div class="panel_left">
				<div id="ContentContainer" class="content_container scrollable"></div>
				<div class="panel_extrareq_inputform">
					<textarea class="cyprite"></textarea>
					<div class="input_sender">
						<img button="true" action="editExtraRequirement" src="{extension_root}/images/feather.svg">
						<div class="cyprite" titlePath="buttons.btnTranslateAgain"></div>
					</div>
				</div>
			</div>
			<div class="panel_right">
				<div class="input_container">
					<div id="Asker" class="input_area cyprite_sender scrollable" contenteditable="true" @paste="onContentPaste" @keyup="onAfterInput"></div>
				</div>
				<div class="input_sender" titlePath="buttons.sendMessageToCyprite" @click="onSendToCyprite"></div>
				<div id="History" class="chat_history_area scrollable">
					<div id="HistoryList" class="chat_history_list" @mouseup="onClickChatItem"></div>
				</div>
			</div>
		</div>
	</div>
</div>
<div id="QuickAccess" class="cyprite_extension cyprite_access">
	<div class="quick_button show_panel" @click="onShowPanel">
		<img src="{extension_root}/images/upFromCenter.svg">
	</div>
	<div class="quick_button show_dialog" @click="onShowDialogInputter">
		<img src="{extension_root}/images/comments.svg">
	</div>
	<div class="panel_logo" @click="onShowComprehensive">
		<img class="logo" src="{extension_root}/images/cyprite.png">
	</div>
	<img id="ThingkingHint2" class="thinking_hint" src="{extension_root}/images/comment-dots.svg">
	<div class="dialogInputter closable">
		<div class="closer" @click="onCloseQuickDialog">
			<img src="{extension_root}/images/circle-xmark.svg">
		</div>
		<textarea id="DialogInputter" placeholdername="mentions.quickAccessHint" @keydown="onQuickSend"></textarea>
	</div>
	<div class="quickReply closable panel_container">
		<div class="closer" @click="onCloseQuickReply">
			<img src="{extension_root}/images/circle-xmark.svg">
		</div>
		<div id="QuickReplyContent" class="inner content_container scrollable"></div>
	</div>
</div>
`;