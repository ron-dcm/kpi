import React from 'react';
import autoBind from 'react-autobind';
import clonedeep from 'lodash.clonedeep';
import Fuse from 'fuse.js';
import {
  getSurveyFlatPaths,
  getFlatQuestionsList
} from 'js/assetUtils';
import {
  QUESTION_TYPES
} from 'js/constants';
import {bem} from 'js/bem';
import {actions} from 'js/actions';
import TextBox from 'js/components/textBox';

const FUSE_OPTIONS = {
  includeScore: true,
  minMatchCharLength: 1,
  shouldSort: false,
  ignoreFieldNorm: true,
  threshold: 0.2,
};

// we need a text to display when we need to say "this question has no answer"
const EMPTY_VALUE_LABEL = t('n/d');
// we need an override value that would mean "no answer" and that would be
// different than "no override answer" (de facto `undefined`)
const EMPTY_VALUE = null;
const MULTIPLE_VALUES_LABEL = t('Multiple responses');
const HELP_ARTICLE_URL = 'https://foo.bar';

/**
 * @prop onSetModalTitle
 * @prop asset
 * @prop data
 * @prop totalSubmissions
 * @prop selectedSubmissions
 */
class BulkEditSubmissionsForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isPending: false,
      overrides: {},
      selectedQuestion: null, // or object
      selectedQuestionOverride: null,
      filterByName: '',
      filterByValue: '',
    };
    this.unlisteners = [];
    autoBind(this);
  }

  componentDidMount() {
    this.unlisteners.push(
      actions.submissions.bulkPatchValues.completed.listen(this.onBulkPatchValuesCompleted),
      actions.submissions.bulkPatchValues.failed.listen(this.onBulkPatchValuesFailed)
    );
    this.setModalTitleToList();
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  onBulkPatchValuesCompleted() {
    this.setState({isPending: false});
    this.props.onModalClose();
  }

  onBulkPatchValuesFailed() {
    this.setState({isPending: false});
  }

  setModalTitleToList() {
    this.props.onSetModalTitle(
      t('Displaying multiple submissions (##count## selected of ##total##)')
        .replace('##count##', this.props.selectedSubmissions.length)
        .replace('##total##', this.props.totalSubmissions)
    );
  }

  setModalTitleToQuestion(questionName) {
    this.props.onSetModalTitle(
      t('Editing "##question##" for ##count## submissions')
        .replace('##question##', questionName)
        .replace('##count##', this.props.selectedSubmissions.length)
    );
  }

  onRowOverrideChange(questionName, value) {
    if (questionName === this.state.selectedQuestion.name) {
      if (value === undefined) {
        this.setState({selectedQuestionOverride: EMPTY_VALUE});
      } else {
        this.setState({selectedQuestionOverride: value});
      }
    }
  }

  onSubmit() {
    this.setState({isPending: true});
    actions.submissions.bulkPatchValues(
      this.props.asset.uid,
      this.props.selectedSubmissions,
      this.state.overrides,
    );
  }

  onReset() {
    this.setState({overrides: {}});
  }

  onFilterByNameChange(newFilter) {
    this.setState({filterByName: newFilter});
  }

  onFilterByValueChange(newFilter) {
    this.setState({filterByValue: newFilter});
  }

  selectQuestion(question) {
    this.setState({
      selectedQuestion: question,
      selectedQuestionOverride: this.state.overrides[question.name],
    });
    this.setModalTitleToQuestion(question.label);
  }

  goBackToList() {
    this.setState({
      selectedQuestion: null,
      selectedQuestionOverride: null,
    });
    this.setModalTitleToList();
  }

  saveOverride() {
    const newOverrides = clonedeep(this.state.overrides);
    if (
      this.state.selectedQuestionOverride === EMPTY_VALUE ||
      (
        typeof this.state.selectedQuestionOverride === 'string' &&
        this.state.selectedQuestionOverride.length >= 1
      )
    ) {
      newOverrides[this.state.selectedQuestion.name] = this.state.selectedQuestionOverride;
    } else {
      delete newOverrides[this.state.selectedQuestion.name];
    }
    this.setState({overrides: newOverrides});
    this.goBackToList();
  }

  getDisplayData() {
    let questions = getFlatQuestionsList(this.props.asset.content.survey);
    let flatPaths = getSurveyFlatPaths(this.props.asset.content.survey);

    questions.forEach((question) => {
      question.selectedData = [];
      const questionPath = flatPaths[question.name];
      this.props.data.forEach((submissionData) => {
        if (this.props.selectedSubmissions.includes(String(submissionData._id))) {
          question.selectedData.push({
            sid: submissionData._id,
            value: submissionData[questionPath]
          });
        }
      });
    });
    return questions;
  }

  renderRow(questionData, itemIndex) {
    let question = questionData;
    if (typeof questionData.refIndex !== 'undefined') {
      question = questionData.item;
    }

    const typeDef = QUESTION_TYPES.get(question.type);
    return (
      <bem.SimpleTable__row key={itemIndex}>
        <bem.SimpleTable__cell>
          {/* TODO fix icon for date time */}
          <i title={typeDef.label} className={['fa', typeDef.faIcon].join(' ')}/>
        </bem.SimpleTable__cell>

        <bem.SimpleTable__cell>
          {question.parents.length > 0 &&
            <small>{question.parents.join(' / ') + ' /'}</small>
          }

          <div>
            {question.isRequired && <strong title={t('Required')}>*&nbsp;</strong>}
            {question.label}
          </div>
        </bem.SimpleTable__cell>

        <bem.SimpleTable__cell>
          {this.renderDataValues(question.name, question.selectedData)}
        </bem.SimpleTable__cell>

        <bem.SimpleTable__cell>
          <bem.KoboTextButton
            m='blue'
            onClick={this.selectQuestion.bind(this, question)}
          >
            {t('Edit')}
          </bem.KoboTextButton>
        </bem.SimpleTable__cell>
      </bem.SimpleTable__row>
    );
  }

  renderDataValues(questionName, rowData) {
    // if there is an override value, let's display it (for override "no answer"
    // we display a label)
    const overrideValue = this.state.overrides[questionName];
    if (typeof overrideValue !== 'undefined') {
      if (overrideValue === null) {
        return (<React.Fragment><i className='blue-response-dot'/> {EMPTY_VALUE_LABEL}</React.Fragment>);
      } else {
        return (<React.Fragment><i className='blue-response-dot'/> {overrideValue}</React.Fragment>);
      }
    }

    const uniqueValues = new Set();
    rowData.forEach((item) => {
      if (item.value) {
        uniqueValues.add(item.value);
      } else {
        uniqueValues.add(EMPTY_VALUE_LABEL);
      }
    });
    const uniqueValuesArray = Array.from(uniqueValues);
    if (uniqueValuesArray.length === 1) {
      // if all rows have same value, we display it
      return uniqueValuesArray[0];
    } else {
      return MULTIPLE_VALUES_LABEL;
    }
  }

  renderList() {
    const displayData = this.getDisplayData();

    let finalData = displayData;
    let fuse = null;

    if (this.state.filterByName !== '') {
      fuse = new Fuse(finalData, {...FUSE_OPTIONS, keys: ['label']});
      finalData = fuse.search(this.state.filterByName);
    }
    if (this.state.filterByValue !== '') {
      fuse = new Fuse(finalData, {...FUSE_OPTIONS, keys: ['selectedData.value']});
      finalData = fuse.search(this.state.filterByValue);
    }

    return (
      <React.Fragment>
        <bem.FormModal__item m='wrapper'>
          {t('You are currently seeing multiple submissions at once. You can select specific questions to edit or remove responses in bulk. If you want to edit only one submission, click on the desired submission on the navigation menu on the top-left corner of this table, or go back to the general table view. You can learn more about bulk actions')} <a href={HELP_ARTICLE_URL}>{t('in the help article')}</a>.
        </bem.FormModal__item>

        <bem.FormModal__item m='wrapper'>
          <i className='blue-response-dot'/>
          {t('Updated responses')}
        </bem.FormModal__item>

        <bem.SimpleTable m='bulk-edit-list'>
          <bem.SimpleTable__header>
            <bem.SimpleTable__row>
              <bem.SimpleTable__cell>
                {t('Type')}
              </bem.SimpleTable__cell>

              <bem.SimpleTable__cell>
                {t('Question')}
              </bem.SimpleTable__cell>

              <bem.SimpleTable__cell>
                {t('Response')}
              </bem.SimpleTable__cell>

              <bem.SimpleTable__cell>
                {t('Action')}
              </bem.SimpleTable__cell>
            </bem.SimpleTable__row>

            <bem.SimpleTable__row>
              <bem.SimpleTable__cell/>

              <bem.SimpleTable__cell>
                <TextBox
                  customModifiers='on-white'
                  value={this.state.filterByName}
                  onChange={this.onFilterByNameChange}
                  placeholder={t('Type to filter')}
                />
              </bem.SimpleTable__cell>

              <bem.SimpleTable__cell>
                <TextBox
                  customModifiers='on-white'
                  value={this.state.filterByValue}
                  onChange={this.onFilterByValueChange}
                  placeholder={t('Type to filter')}
                />
              </bem.SimpleTable__cell>

              <bem.SimpleTable__cell/>
            </bem.SimpleTable__row>
          </bem.SimpleTable__header>

          <bem.SimpleTable__body>
            {finalData.map(this.renderRow)}
          </bem.SimpleTable__body>
        </bem.SimpleTable>

        <bem.Modal__footer>
          <bem.KoboButton
            m='red'
            type='button'
            onClick={this.onReset}
            disabled={this.state.isPending || Object.keys(this.state.overrides).length === 0}
          >
            {t('Discard Changes')}
          </bem.KoboButton>

          <bem.KoboButton
            m='blue'
            type='submit'
            onClick={this.onSubmit}
            disabled={this.state.isPending || Object.keys(this.state.overrides).length === 0}
          >
            {t('Confirm & close')}
          </bem.KoboButton>
        </bem.Modal__footer>
      </React.Fragment>
    );
  }

  renderSelectedQuestion() {
    return (
      <React.Fragment>
        <bem.FormModal__item m='wrapper'>
          {t('You are about to edit responses for one or multiple submissions at once. Use the XML syntax in the text box below. You can also select one of the existing responses from the table of responses. Learn more about how to edit specific responses for one or multiple submissions')} <a href={HELP_ARTICLE_URL} target='_blank'>{t('in the help article')}</a>.
        </bem.FormModal__item>
        <bem.FormModal__item m='wrapper'>
          <BulkEditRowForm
            question={this.state.selectedQuestion}
            overrideData={this.state.selectedQuestionOverride}
            originalData={this.state.selectedQuestion.selectedData}
            onChange={this.onRowOverrideChange}
          />
        </bem.FormModal__item>

        <bem.Modal__footer>
          <bem.KoboButton
            className='footer-back-button'
            m='whitegray'
            type='button'
            onClick={this.goBackToList}
          >
            {t('Back')}
          </bem.KoboButton>

          <bem.KoboButton
            m='blue'
            type='button'
            onClick={this.saveOverride}
          >
            {t('Save')}
          </bem.KoboButton>
        </bem.Modal__footer>
      </React.Fragment>
    );
  }

  render() {
    return (
      <bem.FormModal__form m='bulk-edit-submissions'>
        {this.state.selectedQuestion === null && this.renderList() }
        {this.state.selectedQuestion !== null && this.renderSelectedQuestion() }
      </bem.FormModal__form>
    );
  }
}

/**
 * @prop question
 * @prop overrideData
 * @prop originalData
 * @prop onChange
 */
class BulkEditRowForm extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }

  onChange(newValue) {
    this.props.onChange(this.props.question.name, newValue);
  }

  getPlaceholderValue() {
    let placeholderValue = t('Type new response for selected submissions');
    if (this.props.overrideData === EMPTY_VALUE) {
      // user selected a "no answer" as a new override value for submissions
      // we don't want this EMPTY_VALUE_LABEL to be an editable value, so we
      // display it as a placeholder
      placeholderValue = EMPTY_VALUE_LABEL;
    }
    return placeholderValue;
  }

  getUniqueResponses() {
    let uniqueResponses = new Map();
    this.props.originalData.forEach((item) => {
      if (uniqueResponses.has(item.value)) {
        uniqueResponses.set(item.value, uniqueResponses.get(item.value) + 1);
      } else {
        uniqueResponses.set(item.value, 1);
      }
    });
    // sort by popularity
    uniqueResponses = new Map([...uniqueResponses.entries()].sort((a, b) => {return b[1] - a[1];}));
    return uniqueResponses;
  }

  getResponsePercentage(responseCount) {
    return (responseCount / this.props.originalData.length * 100).toFixed(2);
  }

  renderResponseRow(data) {
    const count = data[1];
    const response = data[0];

    let responseLabel = response;
    let responseValue = response;
    if (response === undefined) {
      responseLabel = EMPTY_VALUE_LABEL;
      responseValue = EMPTY_VALUE;
    }

    const percentage = this.getResponsePercentage(count);

    return (
      <bem.SimpleTable__row key={responseLabel}>
        <bem.SimpleTable__cell>{responseLabel}</bem.SimpleTable__cell>
        <bem.SimpleTable__cell>{count}</bem.SimpleTable__cell>
        <bem.SimpleTable__cell>{percentage}</bem.SimpleTable__cell>
        <bem.SimpleTable__cell>
          <bem.KoboTextButton
            m='blue'
            onClick={this.onChange.bind(this, responseValue)}
          >
            {t('Select')}
          </bem.KoboTextButton>
        </bem.SimpleTable__cell>
      </bem.SimpleTable__row>
    );
  }

  render() {
    let inputValue = '';
    if (typeof this.props.overrideData === 'string') {
      // there is already a non empty override value
      inputValue = this.props.overrideData;
    }

    const typeDef = QUESTION_TYPES.get(this.props.question.type);

    return (
      <React.Fragment>
        <bem.FormView__cell m={['columns', 'columns-top']}>
          <bem.FormView__cell m='column-icon'>
            {/* TODO fix icon for date time */}
            <i title={typeDef.label} className={['fa', typeDef.faIcon].join(' ')}/>
          </bem.FormView__cell>

          <bem.FormView__cell m='column-1'>
            <h2>{this.props.question.label}</h2>

            <TextBox
              customModifiers={['on-white', 'bulk-edit-response']}
              type='text-multiline'
              value={inputValue}
              onChange={this.onChange}
              placeholder={this.getPlaceholderValue()}
            />
          </bem.FormView__cell>
        </bem.FormView__cell>

        <bem.SimpleTable m='bulk-edit-responses'>
          <bem.SimpleTable__header>
            <bem.SimpleTable__row>
              <bem.SimpleTable__cell>{t('Response value')}</bem.SimpleTable__cell>

              <bem.SimpleTable__cell>{t('Frequency')}</bem.SimpleTable__cell>

              <bem.SimpleTable__cell>{t('Percentage')}</bem.SimpleTable__cell>

              <bem.SimpleTable__cell>{t('Action')}</bem.SimpleTable__cell>
            </bem.SimpleTable__row>
          </bem.SimpleTable__header>

          <bem.SimpleTable__body>
            {Array.from(this.getUniqueResponses()).map(this.renderResponseRow)}
          </bem.SimpleTable__body>
        </bem.SimpleTable>
      </React.Fragment>
    );
  }
}

export default BulkEditSubmissionsForm;
