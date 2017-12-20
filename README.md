# Spam Classifier with SVM in JavaScript

This example project demonstrates how [support vector machine (SVM)](https://en.wikipedia.org/wiki/Support_vector_machine) may be used to solve a classification problem (spam filter) in JavaScript. The [SMS Spam Collection Dataset from kaggle](https://www.kaggle.com/uciml/sms-spam-collection-dataset/data) is used for the purpose of training and testing the algorithm. Before training the algorithm, the data set is prepared with common practices to finally extract a feature vector for each SMS. Furthermore, [svm.js](https://github.com/karpathy/svmjs) is used for a ready to go SVM implementation.

As alternative, uncomment the code to use [Naive Bayes classifier](https://en.wikipedia.org/wiki/Naive_Bayes_classifier) instead of SVM from the [natural](https://github.com/NaturalNode/natural) library.

## Installation

* `git clone git@github.com:javascript-machine-learning/svm-spam-classifier-javascript.git`
* `cd svm-spam-classifier-javascript`
* `npm install`
* `npm start`
